'use client';
import { useState, useRef, useEffect, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { processMotorData } from '../lib/processData';
import { generateSampleFleet } from '../lib/sampleData';
import { Motor, ViewKey, ActionState } from '../lib/types';
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
  const handleActionChange = (a: ActionState) => {
    if (!selectedMotor) return;
    setActions((prev) => ({ ...prev, [selectedMotor.file]: a }));
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
            <FleetConsole motors={motors} selectedMotor={selectedMotor} onSelectMotor={handleMotorSelect} actions={actions} />
          )}
          {view === 'inspector' && (
            <MotorInspector motor={selectedMotor} action={currentAction} onActionChange={handleActionChange} />
          )}
          {view === 'setup' && <SetupWizard />}
          {view === 'ai' && <AIAnalysis motors={motors} />}
        </div>
      </div>
    </div>
  );
}