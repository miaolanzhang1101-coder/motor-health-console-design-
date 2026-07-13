'use client';
import { useState, useRef, useEffect, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { processMotorData } from '../lib/processData';
import { generateSampleFleet } from '../lib/sampleData';
import { Motor, ViewKey, ActionState } from '../lib/types';
import {
  DEFAULT_TREE,
  ThresholdNode,
  MOTOR_NODE_MAP,
  getEffectiveThresholdsForMotor,
  getAncestryChain,
  findNode,
  updateNodeOverride,
  collectInheritingDescendants,
  ThresholdValues,
} from '../lib/thresholdTree';
import Sidebar from '../components/ui/Sidebar';
import FleetConsole from '../components/FleetConsole';
import MotorInspector from '../components/MotorInspector';
import SetupWizard from '../components/SetupWizard';
import AIAnalysis from '../components/AIAnalysis';

const VIEWS: ViewKey[] = ['fleet', 'inspector', 'ai', 'setup'];
const VIEW_LABELS: Record<ViewKey, string> = {
  fleet: 'FLEET CONSOLE',
  inspector: 'MOTOR INSPECTOR',
  setup: 'SETUP WIZARD',
  ai: 'AI ANALYSIS',
};

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toUTCString().slice(17, 25) + ' UTC');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function Home() {
  const [view, setView] = useState<ViewKey>('fleet');
  const [motors, setMotors] = useState<Motor[]>([]);
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);
  const [actions, setActions] = useState<Record<string, ActionState>>({});
  const [thresholdTree, setThresholdTree] = useState<ThresholdNode>(DEFAULT_TREE);
  const [selectedThresholdId, setSelectedThresholdId] = useState('global');
  const [flashTokens, setFlashTokens] = useState<Record<string, number>>({});
  const [uploadLabel, setUploadLabel] = useState('UPLOAD CSV');
  const [isLive, setIsLive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const clock = useClock();

  const handleLoadSample = () => {
    const processed = generateSampleFleet();
    setMotors(processed);
    setActions({});
    setIsLive(true);
    setUploadLabel('SAMPLE_FLEET.CSV');
  };

  useEffect(() => {
    handleLoadSample();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCSV = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLabel('PARSING…');

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (r) => {
        const processed = processMotorData(r.data);
        setMotors(processed);
        setActions({});
        setIsLive(true);
        setUploadLabel(file.name.slice(0, 24).toUpperCase());
      },
      error: () => setUploadLabel('PARSE ERROR'),
    });
  };

  const handleMotorSelect = (motor: Motor) => {
    setSelectedMotor(motor);
    setView('inspector');
  };

  const currentAction: ActionState = selectedMotor ? actions[selectedMotor.file] ?? 'none' : 'none';
  const handleActionChange = (motorFile: string, a: ActionState) => {
    setActions((prev) => ({ ...prev, [motorFile]: a }));
  };

  const handleFlash = (ids: string[]) => {
    setFlashTokens((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = (next[id] ?? 0) + 1;
      });
      return next;
    });
  };

  const motorThresholds = selectedMotor
    ? getEffectiveThresholdsForMotor(thresholdTree, selectedMotor.file)
    : { watch: 40, critical: 70 };

  const selectedMotorNodeId = selectedMotor ? MOTOR_NODE_MAP[selectedMotor.file] ?? 'global' : 'global';
  const selectedMotorNode = findNode(thresholdTree, selectedMotorNodeId);
  const hasOwnOverride = selectedMotorNode?.override !== null && selectedMotorNode?.override !== undefined;
  const thresholdAncestry = selectedMotor ? getAncestryChain(thresholdTree, selectedMotorNodeId) : [];

  const handleThresholdOverrideChange = (nodeId: string, override: ThresholdValues | null) => {
    setThresholdTree((prev) => updateNodeOverride(prev, nodeId, override));
    const node = findNode(thresholdTree, nodeId);
    if (node) handleFlash([nodeId, ...collectInheritingDescendants(node)]);
  };

  return (
    <div className="flex h-screen bg-[#0A0B0D] text-[#D7D9E0] font-sans">
      <Sidebar view={view} onNavigate={setView} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-10 flex items-center justify-between border-b border-[#1E212A] bg-[#0D0F13] px-4 shrink-0">
          <span className="text-[11px] font-mono tracking-wide text-[#7C8090]">{VIEW_LABELS[view]}</span>

          <div className="flex items-center gap-3">
            <button
              onClick={handleLoadSample}
              className="text-[10px] font-mono uppercase text-[#7C8090] border border-[#1E212A] px-2.5 py-1 hover:border-[#2A2E3A] hover:text-[#D7D9E0] transition-colors"
            >
              Reload sample
            </button>
            <label className="text-[10px] font-mono uppercase text-[#7C8090] border border-[#1E212A] px-2.5 py-1 cursor-pointer hover:border-[#2A2E3A] hover:text-[#D7D9E0] transition-colors">
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
              {uploadLabel}
            </label>
            <span className="text-[10px] font-mono text-[#4A4E5C] tabular-nums">{clock}</span>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: isLive ? '#22C55E' : '#2A2E3A' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {view === 'fleet' && (
            <FleetConsole
              motors={motors}
              selectedMotor={selectedMotor}
              onSelectMotor={handleMotorSelect}
              actions={actions}
              onActionChange={(file, a) => handleActionChange(file, a)}
              thresholdTree={thresholdTree}
              onThresholdOverrideChange={handleThresholdOverrideChange}
            />
          )}
          {view === 'inspector' && (
            <MotorInspector
              motor={selectedMotor}
              action={currentAction}
              onActionChange={(a) => selectedMotor && handleActionChange(selectedMotor.file, a)}
              thresholds={motorThresholds}
              hasOwnOverride={hasOwnOverride}
              onThresholdOverrideChange={(override) => handleThresholdOverrideChange(selectedMotorNodeId, override)}
              thresholdAncestry={thresholdAncestry}
            />
          )}
          {view === 'setup' && (
            <SetupWizard
              motors={motors}
              tree={thresholdTree}
              onTreeChange={setThresholdTree}
              selectedId={selectedThresholdId}
              onSelectId={setSelectedThresholdId}
              flashTokens={flashTokens}
              onFlash={handleFlash}
            />
          )}
          {view === 'ai' && <AIAnalysis motors={motors} />}
        </div>
      </div>
    </div>
  );
}