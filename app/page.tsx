'use client';
import { useState, useRef, useEffect, ChangeEvent, useMemo } from 'react';
import Papa from 'papaparse';
import { processMotorData } from '../lib/processData';
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
import FleetDashboard from '../components/FleetDashboard';
import CellConsole from '../components/CellConsole';
import SetupWizard from '../components/SetupWizard';
import InspectionBuilder from '../components/InspectionBuilder';
import { RobotCell, Job, cellFromMotor, CellMode } from '../lib/cells';

const VIEW_LABELS: Record<ViewKey, string> = {
  fleet: 'FLEET DASHBOARD',
  inspector: 'CELL CONSOLE',
  setup: 'POLICY EDITOR',
  map: 'FLEET MAP',
  builder: 'INSPECTION BUILDER',
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

let jobCounter = 0;

export default function Home() {
  const [view, setView] = useState<ViewKey>('fleet');
  const [motors, setMotors] = useState<Motor[]>([]);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [cellModeOverrides, setCellModeOverrides] = useState<Record<string, CellMode>>({});
  const [cellStatusOverrides, setCellStatusOverrides] = useState<Record<string, string>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [thresholdTree, setThresholdTree] = useState<ThresholdNode>(DEFAULT_TREE);
  const [selectedThresholdId, setSelectedThresholdId] = useState('global');
  const [flashTokens, setFlashTokens] = useState<Record<string, number>>({});
  const [uploadLabel, setUploadLabel] = useState('UPLOAD CSV');
  const [isLive, setIsLive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const clock = useClock();

  const cells = useMemo(() => {
    return motors.map((m, i) => {
      const base = cellFromMotor(m, i);
      const overrideMode = cellModeOverrides[base.id];
      const overrideStatus = cellStatusOverrides[base.id] as typeof base.status | undefined;
      return {
        ...base,
        ...(overrideMode ? { mode: overrideMode } : {}),
        ...(overrideStatus ? { status: overrideStatus } : {}),
      };
    });
  }, [motors, cellModeOverrides, cellStatusOverrides]);

  const selectedCell = cells.find((c) => c.id === selectedCellId) ?? null;

  // Simulate job progression
  useEffect(() => {
    const id = setInterval(() => {
      setJobs((prev) => {
        const next = [...prev];
        const runningIdx = next.findIndex((j) => j.status === 'running');
        const queuedIdx = next.findIndex((j) => j.status === 'queued');
        if (runningIdx !== -1) {
          const running = next[runningIdx];
          if (running.startedAt && Date.now() - running.startedAt > 8000) {
            next[runningIdx] = { ...running, status: 'done', completedAt: Date.now() };
          }
        }
        const stillRunning = next.some((j) => j.status === 'running');
        if (!stillRunning && queuedIdx !== -1) {
          next[queuedIdx] = { ...next[queuedIdx], status: 'running', startedAt: Date.now() };
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleLoadSample = async () => {
    setUploadLabel('LOADING…');
    try {
      const res = await fetch('/api/motors');
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setMotors(data.motors);
      setIsLive(true);
      setUploadLabel('SAMPLE_FLEET.CSV');
    } catch {
      setUploadLabel('LOAD ERROR');
    }
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
        setMotors(processMotorData(r.data));
        setIsLive(true);
        setUploadLabel(file.name.slice(0, 24).toUpperCase());
      },
      error: () => setUploadLabel('PARSE ERROR'),
    });
  };

  const openCell = (cell: RobotCell) => {
    setSelectedCellId(cell.id);
    setView('inspector');
  };

  const sendJob = (partial: Omit<Job, 'id' | 'status' | 'createdAt'>) => {
    setJobs((prev) => [
      ...prev,
      { ...partial, id: `job-${++jobCounter}`, status: 'queued', createdAt: Date.now() },
    ]);
  };

  const cancelJob = (jobId: string) => setJobs((prev) => prev.filter((j) => j.id !== jobId));

  const handleFlash = (ids: string[]) => {
    setFlashTokens((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = (next[id] ?? 0) + 1; });
      return next;
    });
  };

  const selectedMotorFile = selectedCell?.motor.file;
  const cellThresholds = selectedMotorFile
    ? getEffectiveThresholdsForMotor(thresholdTree, selectedMotorFile)
    : { watch: 40, critical: 70 };

  return (
    <div className="flex h-screen bg-[#0A0B0D] text-[#D7D9E0] font-sans">
      <Sidebar view={view} onNavigate={setView} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-10 flex items-center justify-between border-b border-[#1E212A] bg-[#0D0F13] px-4 shrink-0 z-10">
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
              style={{ background: isLive ? '#3B82F6' : '#2A2E3A' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {view === 'fleet' && (
            <FleetDashboard
              motors={motors}
              onOpenCell={openCell}
              jobs={jobs}
              onSendJob={sendJob}
              onCancelJob={cancelJob}
            />
          )}
          {view === 'inspector' && selectedCell && (
            <CellConsole
              cell={selectedCell}
              allCells={cells}
              jobs={jobs}
              onModeChange={(mode) =>
                setCellModeOverrides((prev) => ({ ...prev, [selectedCell.id]: mode }))
              }
              onStatusChange={(status) =>
                setCellStatusOverrides((prev) => ({ ...prev, [selectedCell.id]: status }))
              }
              onSendJob={sendJob}
              onOpenCell={openCell}
              thresholds={cellThresholds}
              onMotorUpdate={(m) => {
                setMotors((prev) => prev.map((p) => (p.file === m.file ? m : p)));
              }}
            />
          )}
          {view === 'inspector' && !selectedCell && (
            <div className="p-8 text-[10px] font-mono text-[#4A4E5C]">
              Select a cell from the Fleet Dashboard to open its console.
            </div>
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
          {view === 'builder' && <InspectionBuilder />}
        </div>
      </div>
    </div>
  );
}