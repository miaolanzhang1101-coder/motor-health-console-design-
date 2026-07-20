'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import CameraFeed from './CameraFeed';
import FacilityMiniMap from './FacilityMiniMap';
import HoldToConfirm from './ui/HoldToConfirm';
import SlideToConfirm from './ui/SlideToConfirm';
import DigitalTwin, { TwinTarget } from './DigitalTwin';
import { HudPanel, Brackets, TickRuler, Readout, HudChip, BarMeter, HudDivider, HUD_COLOR } from './ui/Hud';
import { RobotCell, CellMode, CellStatus, Job, JobType, JOB_TYPE_LABELS } from '../lib/cells';
import { ThresholdValues } from '../lib/thresholdTree';
import { Motor } from '../lib/types';

interface CellConsoleProps {
  cell: RobotCell;
  allCells: RobotCell[];
  jobs: Job[];
  onModeChange: (mode: CellMode) => void;
  onStatusChange?: (status: CellStatus) => void;
  onOpenCell: (cell: RobotCell) => void;
  onSendJob?: (job: Omit<Job, 'id' | 'status' | 'createdAt'>) => void;
  thresholds: ThresholdValues;
  onMotorUpdate?: (motor: Motor) => void;
}

type WorkflowStep = 1 | 2 | 3 | 4;

const WORKFLOW_STEPS: { id: WorkflowStep; label: string; sub: string }[] = [
  { id: 1, label: 'Dispatch',     sub: 'Send job to cell' },
  { id: 2, label: 'Assistance',   sub: 'Anomaly surfaced' },
  { id: 3, label: 'Digital twin', sub: 'Diagnose the jam' },
  { id: 4, label: 'Recovery',     sub: 'Guided clear' },
];

const RECOVERY_STEPS = [
  { id: 1, title: 'Wait for arm retraction', detail: 'Actuators are safing. Do not enter the cell until retraction completes.' },
  { id: 2, title: 'Realign the workpiece',   detail: 'Rotate the workpiece to the fixture guides. Roughly a 15 degree correction.' },
  { id: 3, title: 'Verify conveyor path',    detail: 'Check upstream and downstream. No debris, no hands in the envelope.' },
  { id: 4, title: 'Clear safety perimeter',  detail: 'Move at least 1m from the cell before authorising resume.' },
];

const JOB_TYPES: JobType[] = ['inspect', 'pick-place', 'return-home', 'calibrate'];

interface EventLog {
  id: string;
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

function deriveJoints(cell: RobotCell) {
  const r = cell.motor.avgRms;
  const k = cell.motor.avgKurt;
  return [
    { id: 'J1', name: 'Base',     angle: 45 + r * 40,  torque: 20 + r * 25, max: 180 },
    { id: 'J2', name: 'Shoulder', angle: -30 + k * 8,  torque: 45 + k * 4,  max: 90 },
    { id: 'J3', name: 'Elbow',    angle: 90 + r * 20,  torque: 30 + r * 15, max: 145 },
    { id: 'J4', name: 'W-rot',    angle: 15,           torque: 8,           max: 180 },
    { id: 'J5', name: 'W-pitch',  angle: -45 + k * 4,  torque: 6 + k,       max: 120 },
    { id: 'J6', name: 'Gripper',  angle: cell.mode === 'manual' ? 60 : 30, torque: 12, max: 90 },
  ];
}

export default function CellConsole({
  cell,
  allCells,
  jobs,
  onModeChange,
  onStatusChange,
  onOpenCell,
  onSendJob,
  onMotorUpdate,
}: CellConsoleProps) {
  const reduceMotion = useReducedMotion();
  const [events, setEvents] = useState<EventLog[]>([]);

  // Explicit navigation state. The previous build derived the step from
  // cell.status alone, which made step 3 unreachable — the Digital Twin
  // button had nothing to set. Now the step is state the UI owns.
  const [step, setStep] = useState<WorkflowStep>(1);
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [completedRecoverySteps, setCompletedRecoverySteps] = useState<Set<number>>(new Set());
  const [diagnosticProgress, setDiagnosticProgress] = useState<number | null>(null);
  const [dispatchedJob, setDispatchedJob] = useState<{ type: JobType; at: number } | null>(null);
  const anomalyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAlert = cell.status === 'assistance-required';

  // Keep the step in sync when the cell resolves or is externally flagged
  useEffect(() => {
    if (isAlert && step === 1) setStep(2);
    if (!isAlert && step !== 1) {
      setStep(1);
      setRecoveryStep(1);
      setCompletedRecoverySteps(new Set());
      setDispatchedJob(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAlert]);

  useEffect(() => () => { if (anomalyTimer.current) clearTimeout(anomalyTimer.current); }, []);

  const pushEvent = (level: EventLog['level'], message: string) => {
    setEvents((prev) => [{ id: `ev-${Date.now()}-${Math.random()}`, ts: Date.now(), level, message }, ...prev].slice(0, 24));
  };

  // Live telemetry stream
  useEffect(() => {
    if (!onMotorUpdate) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/motors/next-window', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ motor: cell.motor }),
        });
        if (!res.ok) return;
        const data = await res.json();
        onMotorUpdate(data.motor);
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [cell.motor.file, onMotorUpdate]);

  // Ambient event log
  useEffect(() => {
    const id = setInterval(() => {
      const r = cell.motor.avgRms;
      const k = cell.motor.avgKurt;
      if (r > 0.8 || k > 6) {
        pushEvent('warn', `Elevated ${r > 0.8 ? 'RMS' : 'kurtosis'} · ${(r > 0.8 ? r : k).toFixed(2)}`);
      } else if (Math.random() < 0.3) {
        pushEvent('info', `Window ${cell.motor.total} · nominal`);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [cell.motor.avgRms, cell.motor.avgKurt, cell.motor.total]);

  const joints = useMemo(() => deriveJoints(cell), [cell]);
  const cellJobs = jobs.filter((j) => j.cellId === cell.id);

  // Diagnostic runner
  useEffect(() => {
    if (diagnosticProgress === null) return;
    if (diagnosticProgress >= 1) {
      const t = setTimeout(() => {
        pushEvent('info', 'Diagnostic passed · autonomy restored');
        onStatusChange?.('running');
        setDiagnosticProgress(null);
      }, 700);
      return () => clearTimeout(t);
    }
    const start = Date.now();
    const from = diagnosticProgress;
    const id = setInterval(() => {
      const p = Math.min(1, from + (Date.now() - start) / 3000);
      setDiagnosticProgress(p);
      if (p >= 1) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [diagnosticProgress, onStatusChange]);

  // Dispatch a job, then let the anomaly surface a few seconds later.
  // This is the narrative spine: a normal task is what exposes the fault.
  const dispatch = (type: JobType) => {
    setDispatchedJob({ type, at: Date.now() });
    onSendJob?.({ cellId: cell.id, type, priority: 'normal' });
    pushEvent('info', `Job dispatched · ${JOB_TYPE_LABELS[type]}`);
    if (anomalyTimer.current) clearTimeout(anomalyTimer.current);
    anomalyTimer.current = setTimeout(() => {
      pushEvent('error', 'Grasp planner halted · confidence 0.31');
      onStatusChange?.('assistance-required');
    }, 3200);
  };

  const accent: 'accent' | 'warn' = isAlert ? 'warn' : 'accent';

  return (
    <motion.div
      key={cell.id}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col min-h-full bg-[#08090C]"
    >
      <CommandBar cell={cell} isAlert={isAlert} onModeChange={onModeChange} />

      <div className="flex flex-1 min-h-0">
        <StepRail step={step} isAlert={isAlert} />

        <div className="flex-1 min-w-0 p-4">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <StepDispatch
                key="s1"
                cell={cell}
                allCells={allCells}
                jobs={cellJobs}
                joints={joints}
                events={events}
                dispatchedJob={dispatchedJob}
                onDispatch={dispatch}
                reduceMotion={reduceMotion}
                onOpenCell={onOpenCell}
              />
            )}
            {step === 2 && (
              <StepAlert
                key="s2"
                cell={cell}
                dispatchedJob={dispatchedJob}
                events={events}
                onProceed={() => setStep(3)}
                reduceMotion={reduceMotion}
              />
            )}
            {step === 3 && (
              <StepTwin
                key="s3"
                cell={cell}
                joints={joints}
                events={events}
                reduceMotion={reduceMotion}
                onBack={() => setStep(2)}
                onProceed={() => setStep(4)}
              />
            )}
            {step === 4 && (
              <StepRecovery
                key="s4"
                recoveryStep={recoveryStep}
                completedSteps={completedRecoverySteps}
                onCompleteStep={(id) => {
                  setCompletedRecoverySteps((prev) => new Set([...prev, id]));
                  setRecoveryStep((prev) => Math.min(RECOVERY_STEPS.length, prev + 1));
                  pushEvent('info', `Recovery step ${id} confirmed`);
                }}
                onResume={() => setDiagnosticProgress(0)}
                diagnosticProgress={diagnosticProgress}
                reduceMotion={reduceMotion}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================
   COMMAND BAR — the persistent instrument header
   ============================================================ */
function CommandBar({
  cell,
  isAlert,
  onModeChange,
}: {
  cell: RobotCell;
  isAlert: boolean;
  onModeChange: (m: CellMode) => void;
}) {
  const [clock, setClock] = useState('--:--:--');
  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="border-b border-[#1E232B] bg-[#0A0C0F]">
      {/* upper strip — identity + global readouts */}
      <div className="flex items-stretch">
        <div className="relative px-4 py-2.5 border-r border-[#1E232B] min-w-[200px]">
          <Brackets intent={isAlert ? 'warn' : 'accent'} size={6} />
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-600">Cell</div>
          <div className="text-lg font-mono tabular-nums text-neutral-100 leading-tight">{cell.name}</div>
          <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-neutral-600">{cell.location}</div>
        </div>

        <div className="flex items-center gap-6 px-5 border-r border-[#1E232B]">
          <Readout label="Mode" value={cell.mode} size="sm" intent={isAlert ? 'warn' : 'accent'} />
          <Readout label="Battery" value={Math.round(cell.battery)} unit="%" size="sm" />
          <Readout label="Util" value={cell.utilizationPct} unit="%" size="sm" />
          <Readout label="Fault" value={cell.motor.faultPct.toFixed(1)} unit="%" size="sm"
            intent={cell.motor.faultPct > 10 ? 'warn' : 'neutral'} />
        </div>

        <div className="flex-1 flex items-center px-5 gap-4 min-w-0">
          <TickRuler count={30} intent={isAlert ? 'warn' : 'neutral'} />
          <HudChip
            label={isAlert ? 'Assistance required' : 'Nominal'}
            intent={isAlert ? 'warn' : 'safe'}
            pulse={isAlert}
          />
        </div>

        <div className="flex items-center gap-4 px-4 border-l border-[#1E232B]">
          <div className="text-right">
            <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-neutral-600">UTC</div>
            <div className="text-sm font-mono tabular-nums text-neutral-300 leading-tight">{clock}</div>
          </div>
          <ModeToggle mode={cell.mode} onChange={onModeChange} disabled={isAlert} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   STEP RAIL — vertical workflow spine on the far left
   ============================================================ */
function StepRail({ step, isAlert }: { step: WorkflowStep; isAlert: boolean }) {
  return (
    <div className="w-[168px] shrink-0 border-r border-[#1E232B] bg-[#0A0C0F] py-4 px-3">
      <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-600 mb-3 px-1">
        Workflow
      </div>

      <div className="relative flex flex-col gap-1">
        {WORKFLOW_STEPS.map((s, i) => {
          const done = s.id < step;
          const active = s.id === step;
          const intent = active ? (isAlert && s.id >= 2 ? 'warn' : 'accent') : done ? 'safe' : 'neutral';
          const c = HUD_COLOR[intent];
          return (
            <div key={s.id} className="relative">
              {i < WORKFLOW_STEPS.length - 1 && (
                <div
                  className="absolute left-[13px] top-[30px] w-px h-[18px]"
                  style={{ background: done ? HUD_COLOR.safe : '#1E232B' }}
                />
              )}
              <div
                className="relative flex items-start gap-2.5 px-2 py-2"
                style={{
                  background: active ? `${c}12` : 'transparent',
                  borderLeft: `2px solid ${active ? c : 'transparent'}`,
                }}
              >
                <div
                  className="w-[18px] h-[18px] shrink-0 flex items-center justify-center text-[10px] font-mono tabular-nums mt-px"
                  style={{
                    border: `1px solid ${active || done ? c : '#2A303B'}`,
                    color: done ? '#08090C' : active ? c : '#4B5563',
                    background: done ? c : 'transparent',
                  }}
                >
                  {done ? '✓' : s.id}
                </div>
                <div className="min-w-0">
                  <div
                    className="text-[11px] font-mono uppercase tracking-[0.08em] leading-tight"
                    style={{ color: active ? '#E5E7EB' : done ? '#9CA3AF' : '#4B5563' }}
                  >
                    {s.label}
                  </div>
                  <div className="text-[9px] font-mono text-neutral-700 leading-tight mt-0.5">
                    {s.sub}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <TickRuler count={12} />
      </div>
    </div>
  );
}

/* ============================================================
   STEP 1 — DISPATCH. Job sending is the primary left column.
   ============================================================ */
function StepDispatch({
  cell, allCells, jobs, joints, events, dispatchedJob, onDispatch, reduceMotion, onOpenCell,
}: any) {
  const [selected, setSelected] = useState<JobType>('pick-place');
  const pending = dispatchedJob !== null;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="grid grid-cols-[360px_1fr_300px] gap-3 h-full"
    >
      {/* LEFT — dispatch console, the loudest thing on the page */}
      <div className="flex flex-col gap-3">
        <div className="relative border border-[#60A5FA]/40 bg-[#60A5FA]/[0.04]">
          <Brackets intent="accent" size={12} weight={1.5} />
          <div className="px-4 pt-4 pb-3">
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#60A5FA] mb-1">
              Step 01 · Dispatch
            </div>
            <div className="text-xl font-mono uppercase tracking-tight text-neutral-100 leading-tight">
              Send a job
            </div>
            <div className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
              Select a task profile and dispatch it to {cell.name}. Telemetry streams live below.
            </div>
          </div>

          <div className="px-4 pb-4 flex flex-col gap-1.5">
            {JOB_TYPES.map((t) => {
              const on = selected === t;
              return (
                <button
                  key={t}
                  onClick={() => setSelected(t)}
                  disabled={pending}
                  aria-pressed={on}
                  className="relative w-full flex items-center justify-between px-3 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    border: `1px solid ${on ? '#60A5FA' : '#1E232B'}`,
                    background: on ? 'rgba(96,165,250,0.10)' : 'transparent',
                  }}
                >
                  {on && <Brackets intent="accent" size={5} />}
                  <span
                    className="text-[12px] font-mono uppercase tracking-[0.1em]"
                    style={{ color: on ? '#93C5FD' : '#6B7280' }}
                  >
                    {JOB_TYPE_LABELS[t]}
                  </span>
                  <span className="text-[9px] font-mono tabular-nums" style={{ color: on ? '#60A5FA' : '#374151' }}>
                    {on ? 'SEL' : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="px-4 pb-4">
            {pending ? (
              <div className="relative border border-[#60A5FA]/40 px-4 py-3.5">
                <Brackets intent="accent" size={6} />
                <div className="flex items-center gap-2.5">
                  <motion.span
                    className="inline-block w-2 h-2 bg-[#60A5FA]"
                    animate={reduceMotion ? {} : { opacity: [1, 0.15, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                  />
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#60A5FA]">
                      Executing · {JOB_TYPE_LABELS[dispatchedJob.type]}
                    </div>
                    <div className="text-[9px] font-mono text-neutral-600 mt-0.5">
                      Monitoring grasp confidence
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => onDispatch(selected)}
                className="relative w-full px-4 py-4 text-[14px] font-mono uppercase tracking-[0.2em] font-medium transition-colors"
                style={{
                  border: '1.5px solid #60A5FA',
                  background: 'rgba(96,165,250,0.14)',
                  color: '#93C5FD',
                }}
              >
                <Brackets intent="accent" size={8} weight={1.5} />
                Dispatch job
              </button>
            )}
          </div>
        </div>

        <HudPanel label="Queue" right={`${jobs.length}`} dense>
          {jobs.length === 0 ? (
            <div className="px-3 py-3 text-[10px] font-mono text-neutral-700">No active jobs</div>
          ) : (
            jobs.map((j: Job) => (
              <div key={j.id} className="px-3 py-2 border-b border-[#12161C] last:border-b-0 flex items-center justify-between">
                <span className="text-[11px] font-mono text-neutral-300">{JOB_TYPE_LABELS[j.type]}</span>
                <span
                  className="text-[9px] font-mono uppercase tracking-[0.14em]"
                  style={{
                    color: j.status === 'running' ? '#60A5FA' : j.status === 'done' ? '#10B981' : j.status === 'failed' ? '#EF4444' : '#6B7280',
                  }}
                >
                  {j.status}
                </span>
              </div>
            ))
          )}
        </HudPanel>
      </div>

      {/* CENTRE — the cell itself */}
      <div className="flex flex-col gap-3 min-w-0">
        <div className="relative flex-1 min-h-[280px] border border-[#1E232B]">
          <Brackets intent="neutral" size={12} />
          <CameraFeed cell={cell} size="large" />
        </div>
        <TelemetryStrip joints={joints} />
      </div>

      {/* RIGHT — context */}
      <div className="flex flex-col gap-3">
        <HudPanel label="Position">
          <FacilityMiniMap cells={allCells} highlightCellId={cell.id} onCellClick={onOpenCell} compact />
        </HudPanel>
        <EventLog events={events} reduceMotion={reduceMotion} />
      </div>
    </motion.div>
  );
}

/* ============================================================
   STEP 2 — ALERT
   ============================================================ */
function StepAlert({
  cell, dispatchedJob, events, onProceed, reduceMotion,
}: {
  cell: RobotCell;
  dispatchedJob: { type: JobType; at: number } | null;
  events: EventLog[];
  onProceed: () => void;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="grid grid-cols-[1fr_300px] gap-3 h-full"
    >
      <div className="flex flex-col gap-3">
        <div className="relative border-2 border-[#F59E0B]/50 bg-[#F59E0B]/[0.05] p-6">
          <Brackets intent="warn" size={16} weight={2} />

          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 mb-3">
                <motion.span
                  className="inline-block w-3 h-3 bg-[#F59E0B]"
                  animate={reduceMotion ? {} : { opacity: [1, 0.15, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                />
                <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#F59E0B]">
                  Fault · human intervention
                </span>
              </div>

              <h2 className="text-3xl font-mono uppercase tracking-tight text-[#F59E0B] leading-none">
                Assistance required
              </h2>

              <p className="text-[13px] text-neutral-300 leading-relaxed mt-4 max-w-xl">
                {cell.name} halted during{' '}
                <span className="text-neutral-100 font-mono">
                  {dispatchedJob ? JOB_TYPE_LABELS[dispatchedJob.type] : 'execution'}
                </span>
                . The vision stack resolved a misaligned workpiece and the grasp planner
                dropped below its confidence floor. Actuators are holding position.
              </p>
            </div>

            <div className="shrink-0 w-24 h-24 relative">
              <Brackets intent="warn" size={8} />
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl text-[#F59E0B]" aria-hidden="true">⚠</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-6">
            {[
              { label: 'Grasp confidence', value: '0.31', unit: '', sub: 'floor 0.75' },
              { label: 'Halted', value: '00:42', unit: '', sub: 'since detect' },
              { label: 'Skew', value: '15', unit: '°', sub: 'tol ±3°' },
            ].map((m) => (
              <div key={m.label} className="relative border border-[#F59E0B]/30 px-3 py-2.5">
                <Brackets intent="warn" size={5} />
                <Readout label={m.label} value={m.value} unit={m.unit} intent="warn" size="lg" />
                <div className="text-[9px] font-mono text-neutral-600 mt-1">{m.sub}</div>
              </div>
            ))}
          </div>

          <button
            onClick={onProceed}
            className="relative w-full mt-6 px-6 py-4 text-[14px] font-mono uppercase tracking-[0.24em] font-medium transition-colors"
            style={{ border: '1.5px solid #F59E0B', background: 'rgba(245,158,11,0.16)', color: '#FCD34D' }}
          >
            <Brackets intent="warn" size={8} weight={1.5} />
            Open digital twin →
          </button>
          <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-neutral-600 text-center mt-2">
            Inspect the anomaly before intervening
          </div>
        </div>

        <div className="flex-1" />
      </div>

      <EventLog events={events} reduceMotion={reduceMotion} />
    </motion.div>
  );
}

/* ============================================================
   STEP 3 — DIGITAL TWIN
   ============================================================ */
interface ParamCard {
  id: string;
  label: string;
  value: string;
  delta: string;
  target: TwinTarget;
  intent: 'warn' | 'accent';
}

function StepTwin({ cell, joints, events, reduceMotion, onBack, onProceed }: any) {
  const [sel, setSel] = useState<string | null>(null);

  const params: ParamCard[] = [
    { id: 'gripper',   label: 'Gripper width',  value: '48',  delta: 'target 42mm',   target: 'gripper',   intent: 'warn' },
    { id: 'workpiece', label: 'Workpiece skew', value: '15',  delta: 'tol ±3°',       target: 'workpiece', intent: 'warn' },
    { id: 'joint2',    label: 'J2 shoulder',    value: joints[1].angle.toFixed(1), delta: `${joints[1].torque.toFixed(1)} Nm`, target: 'joint2', intent: 'accent' },
    { id: 'base',      label: 'Base rotation',  value: joints[0].angle.toFixed(1), delta: `${joints[0].torque.toFixed(1)} Nm`, target: 'base',   intent: 'accent' },
  ];

  const active = params.find((p) => p.id === sel);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="grid grid-cols-[1fr_300px] gap-3 h-full"
    >
      <div className="flex flex-col gap-3 min-w-0">
        <div className="relative flex-1 min-h-[300px] border-2 border-[#F59E0B]/40">
          <Brackets intent="warn" size={14} weight={1.5} />
          <DigitalTwin
            cell={cell}
            focusTarget={active?.target ?? null}
            auraColor={active ? HUD_COLOR[active.intent] : HUD_COLOR.accent}
          />
        </div>

        <div>
          <HudDivider label="Parameters · tap to isolate" intent="warn" />
          <div className="grid grid-cols-4 gap-2 mt-1.5">
            {params.map((p) => {
              const on = p.id === sel;
              const c = HUD_COLOR[p.intent];
              return (
                <button
                  key={p.id}
                  onClick={() => setSel(on ? null : p.id)}
                  aria-pressed={on}
                  className="relative px-3 py-2.5 text-left transition-all"
                  style={{
                    border: `1px solid ${on ? c : `${c}33`}`,
                    background: on ? `${c}16` : 'transparent',
                    boxShadow: on ? `0 0 18px ${c}30` : undefined,
                  }}
                >
                  {on && <Brackets intent={p.intent} size={6} />}
                  <Readout label={p.label} value={p.value} intent={p.intent} />
                  <div className="text-[9px] font-mono text-neutral-600 mt-1">{p.delta}</div>
                </button>
              );
            })}
          </div>
        </div>

        <TelemetryStrip joints={joints} frozen />

        <div className="grid grid-cols-[140px_1fr] gap-2">
          <button
            onClick={onBack}
            className="px-4 py-3.5 text-[11px] font-mono uppercase tracking-[0.18em] text-neutral-500 border border-[#1E232B] hover:text-neutral-300 hover:border-[#2A303B] transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={onProceed}
            className="relative px-6 py-3.5 text-[13px] font-mono uppercase tracking-[0.22em] font-medium transition-colors"
            style={{ border: '1.5px solid #60A5FA', background: 'rgba(96,165,250,0.14)', color: '#93C5FD' }}
          >
            <Brackets intent="accent" size={7} weight={1.5} />
            Begin recovery →
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <HudPanel label="Diagnosis" intent="warn">
          <p className="text-[11px] text-neutral-300 leading-relaxed">
            Twin reconstructed from the perception stack. A workpiece entered the pick zone
            rotated 15° from expected orientation, outside the grasp planner's tolerance band.
          </p>
        </HudPanel>
        <EventLog events={events} reduceMotion={reduceMotion} />
      </div>
    </motion.div>
  );
}

/* ============================================================
   STEP 4 — RECOVERY
   ============================================================ */
function StepRecovery({
  recoveryStep, completedSteps, onCompleteStep, onResume, diagnosticProgress, reduceMotion,
}: any) {
  const idx = Math.min(RECOVERY_STEPS.length - 1, Math.max(0, recoveryStep - 1));
  const activeStep = RECOVERY_STEPS[idx];
  const allDone = completedSteps.size === RECOVERY_STEPS.length;
  const inDiag = diagnosticProgress !== null;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="grid grid-cols-[1fr_440px] gap-3 h-full"
    >
      <div className="flex flex-col gap-3 min-w-0">
        <HudDivider label={`Visual guide · ${activeStep.id} of ${RECOVERY_STEPS.length}`} intent="warn" />
        <div className="relative flex-1 min-h-[300px] border-2 border-[#F59E0B]/40 overflow-hidden">
          <Brackets intent="warn" size={14} weight={1.5} />
          {inDiag
            ? <DiagnosticAnimation progress={diagnosticProgress} reduceMotion={reduceMotion} />
            : <RecoveryStepAnimation stepId={activeStep.id} reduceMotion={reduceMotion} />}
        </div>
        <div className="relative border border-[#1E232B] p-4">
          <Brackets intent="neutral" size={8} />
          <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-600">Active step</div>
          <div className="text-[15px] font-mono uppercase tracking-tight text-neutral-100 mt-1">{activeStep.title}</div>
          <div className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">{activeStep.detail}</div>
        </div>
      </div>

      <div className="relative border-2 border-[#F59E0B]/45 bg-[#F59E0B]/[0.03] flex flex-col">
        <Brackets intent="warn" size={12} weight={1.5} />

        <div className="px-4 py-3 border-b border-[#F59E0B]/25 flex items-center justify-between">
          <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#F59E0B]">
            Recovery checklist
          </span>
          <span className="text-[10px] font-mono tabular-nums text-neutral-500">
            {completedSteps.size} / {RECOVERY_STEPS.length}
          </span>
        </div>

        <div className="p-3 flex flex-col gap-2 flex-1">
          {RECOVERY_STEPS.map((s) => {
            const done = completedSteps.has(s.id);
            const current = s.id === activeStep.id && !done && !inDiag;
            const c = done ? HUD_COLOR.safe : current ? HUD_COLOR.warn : '#2A303B';
            return (
              <div
                key={s.id}
                className="relative px-3 py-3"
                style={{
                  border: `1px solid ${done ? `${HUD_COLOR.safe}44` : current ? HUD_COLOR.warn : '#1E232B'}`,
                  background: current ? 'rgba(245,158,11,0.06)' : done ? 'rgba(16,185,129,0.03)' : 'transparent',
                }}
              >
                {current && <Brackets intent="warn" size={6} />}
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-[22px] h-[22px] shrink-0 flex items-center justify-center text-[11px] font-mono tabular-nums"
                    style={{
                      border: `1px solid ${c}`,
                      color: done ? '#08090C' : current ? HUD_COLOR.warn : '#4B5563',
                      background: done ? HUD_COLOR.safe : 'transparent',
                    }}
                  >
                    {done ? '✓' : s.id}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[12px] font-mono uppercase tracking-[0.06em] leading-tight"
                      style={{ color: done ? '#6B7280' : current ? '#E5E7EB' : '#4B5563' }}
                    >
                      {s.title}
                    </div>
                    <div className="text-[10px] text-neutral-600 mt-1 leading-relaxed">{s.detail}</div>
                    {current && (
                      <div className="mt-3">
                        <SlideToConfirm onConfirm={() => onCompleteStep(s.id)} label="Slide to confirm" intent="warn" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[#F59E0B]/25 p-4">
          {inDiag ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#60A5FA]">
                  Diagnostic
                </span>
                <span className="text-[11px] font-mono tabular-nums text-[#60A5FA]">
                  {Math.round((diagnosticProgress ?? 0) * 100)}%
                </span>
              </div>
              <BarMeter value={diagnosticProgress ?? 0} intent="accent" height={3} />
              <div className="grid grid-cols-3 gap-2 mt-3">
                <DiagCheck label="Perception" done={(diagnosticProgress ?? 0) > 0.33} />
                <DiagCheck label="Actuators"  done={(diagnosticProgress ?? 0) > 0.66} />
                <DiagCheck label="Safety"     done={(diagnosticProgress ?? 0) >= 1} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <HoldToConfirm
                onConfirm={onResume}
                label="Resume"
                sublabel="autonomy"
                intent="safe"
                disabled={!allDone}
                icon={<span aria-hidden="true">▶</span>}
              />
              <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-neutral-600 mt-6">
                {allDone ? 'Hold 1.5s to authorise' : `${RECOVERY_STEPS.length - completedSteps.size} steps remaining`}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DiagCheck({ label, done }: { label: string; done: boolean }) {
  return (
    <div
      className="px-2 py-1.5 flex items-center gap-1.5"
      style={{
        border: `1px solid ${done ? HUD_COLOR.safe : '#1E232B'}`,
        color: done ? HUD_COLOR.safe : '#4B5563',
        background: done ? 'rgba(16,185,129,0.06)' : 'transparent',
      }}
    >
      <span className="text-[10px]">{done ? '✓' : '·'}</span>
      <span className="text-[9px] font-mono uppercase tracking-[0.12em]">{label}</span>
    </div>
  );
}

/* ============================================================
   TELEMETRY STRIP
   ============================================================ */
function TelemetryStrip({ joints, frozen }: { joints: any[]; frozen?: boolean }) {
  return (
    <div className="relative border border-[#1E232B] bg-[#0A0C0F]">
      <Brackets intent="neutral" size={8} />
      <div className="px-3 py-1.5 border-b border-[#1E232B] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1 h-1 bg-neutral-600" />
          <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-600">
            Joint telemetry {frozen && '· frozen'}
          </span>
        </div>
        <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-[0.14em]">
          {frozen ? 'captured' : 'live'} · 6 axes
        </span>
      </div>
      <div className="grid grid-cols-6">
        {joints.map((j: any) => {
          const travel = Math.abs(j.angle) / j.max;
          const load = j.torque / 60;
          return (
            <div key={j.id} className="px-3 py-2.5 border-r border-[#12161C] last:border-r-0">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] font-mono text-neutral-500">{j.id}</span>
                <span className="text-[9px] font-mono text-neutral-700">{j.name}</span>
              </div>
              <div className="text-[15px] font-mono tabular-nums text-neutral-100 mt-1.5 leading-none">
                {j.angle.toFixed(1)}<span className="text-neutral-600">°</span>
              </div>
              <div className="mt-1.5">
                <BarMeter value={travel} intent={load > 0.75 ? 'warn' : 'accent'} />
              </div>
              <div className="text-[10px] font-mono tabular-nums text-neutral-500 mt-1.5">
                {j.torque.toFixed(1)}<span className="text-neutral-700"> Nm</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   EVENT LOG
   ============================================================ */
function EventLog({ events, reduceMotion }: { events: EventLog[]; reduceMotion: boolean | null }) {
  return (
    <div className="relative border border-[#1E232B] bg-[#0A0C0F] flex-1 min-h-0 flex flex-col">
      <Brackets intent="neutral" size={8} />
      <div className="px-3 py-1.5 border-b border-[#1E232B] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1 h-1 bg-neutral-600" />
          <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-600">Event log</span>
        </div>
        <span className="text-[9px] font-mono tabular-nums text-neutral-700">{events.length}</span>
      </div>
      <div className="overflow-y-auto flex-1" style={{ maxHeight: 320 }}>
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <div className="px-3 py-3 text-[10px] font-mono text-neutral-700">Listening…</div>
          ) : events.map((ev) => {
            const c = ev.level === 'error' ? HUD_COLOR.danger : ev.level === 'warn' ? HUD_COLOR.warn : '#4B5563';
            return (
              <motion.div
                key={ev.id}
                initial={reduceMotion ? false : { opacity: 0, x: -3 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="px-3 py-1.5 border-b border-[#12161C] last:border-b-0 flex items-baseline gap-2"
              >
                <span className="inline-block w-1 h-1 shrink-0 translate-y-[-1px]" style={{ background: c }} />
                <span className="text-[10px] font-mono text-neutral-300 flex-1 truncate">{ev.message}</span>
                <span className="text-[9px] font-mono tabular-nums text-neutral-700">
                  {new Date(ev.ts).toISOString().slice(11, 19)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ============================================================
   MODE TOGGLE
   ============================================================ */
function ModeToggle({ mode, onChange, disabled }: { mode: CellMode; onChange: (m: CellMode) => void; disabled?: boolean }) {
  const modes: CellMode[] = ['autonomous', 'manual', 'stopped'];
  return (
    <div className="flex" role="tablist" aria-label="Cell mode">
      {modes.map((m) => {
        const on = mode === m;
        const c = m === 'stopped' ? HUD_COLOR.danger : HUD_COLOR.accent;
        return (
          <button
            key={m}
            onClick={() => !disabled && onChange(m)}
            disabled={disabled}
            role="tab"
            aria-selected={on}
            className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-[0.16em] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              border: `1px solid ${on ? c : '#1E232B'}`,
              marginLeft: -1,
              color: on ? c : '#4B5563',
              background: on ? `${c}12` : 'transparent',
            }}
          >
            {m.slice(0, 4)}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   STEP ANIMATIONS
   ============================================================ */
function RecoveryStepAnimation({ stepId, reduceMotion }: { stepId: number; reduceMotion: boolean | null }) {
  if (stepId === 1) return <AnimRetract reduceMotion={reduceMotion} />;
  if (stepId === 2) return <AnimRealign reduceMotion={reduceMotion} />;
  if (stepId === 3) return <AnimScan reduceMotion={reduceMotion} />;
  return <AnimPerimeter reduceMotion={reduceMotion} />;
}

function AnimFrame({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full bg-[#08090C]">
      <defs>
        <pattern id="hud-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#12161C" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="400" height="300" fill="url(#hud-grid)" />
      <text x="16" y="26" fontSize="11" fontFamily="var(--font-mono)" fill="#F59E0B" letterSpacing="2">{title}</text>
      <text x="16" y="40" fontSize="8.5" fontFamily="var(--font-mono)" fill="#6B7280" letterSpacing="1">{sub}</text>
      {children}
    </svg>
  );
}

function AnimRetract({ reduceMotion }: { reduceMotion: boolean | null }) {
  const t = reduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' as const, times: [0, 0.4, 0.7, 1] };
  return (
    <AnimFrame title="SAFING · ARM RETRACT" sub="AWAIT FULL RETRACTION">
      <rect x="180" y="70" width="40" height="16" fill="#374151" />
      <motion.g animate={reduceMotion ? {} : { rotate: [30, 0, 0, 30] }} transition={t} style={{ transformOrigin: '200px 86px' }}>
        <rect x="196" y="86" width="8" height="78" fill="#6B7280" />
        <circle cx="200" cy="164" r="6" fill="#60A5FA" />
        <motion.g animate={reduceMotion ? {} : { rotate: [40, 0, 0, 40] }} transition={t} style={{ transformOrigin: '200px 164px' }}>
          <rect x="196" y="164" width="8" height="52" fill="#6B7280" />
          <rect x="189" y="214" width="22" height="7" fill="#10B981" />
        </motion.g>
      </motion.g>
      <motion.circle
        cx="200" cy="130" r="62" fill="none" stroke="#60A5FA" strokeWidth="1" strokeDasharray="3 4"
        animate={reduceMotion ? {} : { opacity: [0.25, 0.7, 0.25] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <text x="16" y="284" fontSize="8" fontFamily="var(--font-mono)" fill="#374151">SAFE ENVELOPE R=62</text>
    </AnimFrame>
  );
}

function AnimRealign({ reduceMotion }: { reduceMotion: boolean | null }) {
  const t = reduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' as const, times: [0, 0.4, 0.7, 1] };
  return (
    <AnimFrame title="REALIGN · 15° → 0°" sub="ROTATE TO FIXTURE GUIDES">
      <rect x="142" y="120" width="3" height="120" fill="#374151" />
      <rect x="255" y="120" width="3" height="120" fill="#374151" />
      <text x="150" y="114" fontSize="8" fontFamily="var(--font-mono)" fill="#4B5563">GUIDE A</text>
      <text x="212" y="114" fontSize="8" fontFamily="var(--font-mono)" fill="#4B5563">GUIDE B</text>
      <rect x="120" y="242" width="160" height="6" fill="#1E232B" />
      <motion.g animate={reduceMotion ? {} : { rotate: [15, 0, 0, 15] }} transition={t} style={{ transformOrigin: '200px 180px' }}>
        <rect x="152" y="162" width="96" height="36" fill="#374151" stroke="#6B7280" strokeWidth="1" />
        <circle cx="200" cy="180" r="2.5" fill="#F59E0B" />
      </motion.g>
      <motion.g animate={reduceMotion ? {} : { x: [14, -4, -4, 14] }} transition={t}>
        <path d="M 286 174 L 296 174 L 296 179 L 301 179 L 301 174 L 306 174 L 306 194 L 286 194 Z" fill="#60A5FA" />
      </motion.g>
      <text x="16" y="284" fontSize="8" fontFamily="var(--font-mono)" fill="#374151">TOLERANCE ±3°</text>
    </AnimFrame>
  );
}

function AnimScan({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <AnimFrame title="VERIFY · CONVEYOR PATH" sub="SWEEP UPSTREAM AND DOWNSTREAM">
      <rect x="40" y="142" width="320" height="28" fill="#0E1116" stroke="#1E232B" />
      {Array.from({ length: 16 }).map((_, i) => (
        <line key={i} x1={52 + i * 20} y1="146" x2={52 + i * 20} y2="166" stroke="#1E232B" strokeWidth="0.5" />
      ))}
      <rect x="182" y="148" width="36" height="16" fill="#374151" stroke="#6B7280" />
      <motion.rect
        x="52" y="132" width="8" height="48" fill="#60A5FA" fillOpacity={0.28}
        animate={reduceMotion ? {} : { x: [52, 340, 52] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: 'linear' }}
      />
      {[80, 132, 184, 240, 292, 340].map((x, i) => (
        <motion.text
          key={i} x={x} y="124" fontSize="12" fontFamily="var(--font-mono)" fill="#10B981" textAnchor="middle"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={reduceMotion ? {} : { opacity: [0, 0, 1, 1, 0] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, times: [0, i * 0.15, i * 0.15 + 0.04, 0.94, 1] }}
        >✓</motion.text>
      ))}
      <text x="42" y="196" fontSize="8" fontFamily="var(--font-mono)" fill="#374151">← UPSTREAM</text>
      <text x="358" y="196" fontSize="8" fontFamily="var(--font-mono)" fill="#374151" textAnchor="end">DOWNSTREAM →</text>
    </AnimFrame>
  );
}

function AnimPerimeter({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <AnimFrame title="CLEAR · SAFETY PERIMETER" sub="MINIMUM STANDOFF 1M">
      <rect x="146" y="92" width="108" height="108" fill="none" stroke="#374151" strokeWidth="1.5" />
      <text x="200" y="150" fontSize="9" fontFamily="var(--font-mono)" fill="#4B5563" textAnchor="middle">CELL</text>
      <motion.rect
        x="86" y="34" width="228" height="224" fill="none" stroke="#F59E0B" strokeWidth="1" strokeDasharray="5 4"
        animate={reduceMotion ? {} : { opacity: [0.3, 0.9, 0.3] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.g
        animate={reduceMotion ? {} : { x: [0, 108, 108, 0] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 3.5, repeat: Infinity, ease: 'easeInOut', times: [0, 0.4, 0.7, 1] }}
      >
        <circle cx="200" cy="142" r="5.5" fill="#60A5FA" />
        <rect x="196.5" y="148" width="7" height="17" fill="#60A5FA" />
        <line x1="200" y1="165" x2="196" y2="177" stroke="#60A5FA" strokeWidth="1.8" />
        <line x1="200" y1="165" x2="204" y2="177" stroke="#60A5FA" strokeWidth="1.8" />
      </motion.g>
      <text x="16" y="284" fontSize="8" fontFamily="var(--font-mono)" fill="#374151">RESUME LOCKED WHILE INSIDE</text>
    </AnimFrame>
  );
}

function DiagnosticAnimation({ progress, reduceMotion }: { progress: number; reduceMotion: boolean | null }) {
  const rings = [
    { r: 88, label: 'PERCEPTION', threshold: 0.33 },
    { r: 68, label: 'ACTUATORS',  threshold: 0.66 },
    { r: 48, label: 'SAFETY',     threshold: 1.0 },
  ];
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full bg-[#08090C]">
      <rect width="400" height="300" fill="url(#hud-grid)" />
      <text x="16" y="26" fontSize="11" fontFamily="var(--font-mono)" fill="#60A5FA" letterSpacing="2">
        DIAGNOSTIC · {Math.round(progress * 100)}%
      </text>
      {rings.map((s, i) => {
        const done = progress >= s.threshold;
        const circ = 2 * Math.PI * s.r;
        return (
          <g key={i}>
            <circle cx="200" cy="168" r={s.r} fill="none" stroke="#12161C" strokeWidth="2" />
            <circle
              cx="200" cy="168" r={s.r} fill="none"
              stroke={done ? '#10B981' : '#60A5FA'} strokeWidth="2"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - Math.min(1, progress / s.threshold))}
              transform="rotate(-90 200 168)"
            />
            <text x={200 + s.r + 8} y="172" fontSize="8" fontFamily="var(--font-mono)"
              fill={done ? '#10B981' : '#4B5563'} letterSpacing="1">
              {done ? '✓ ' : ''}{s.label}
            </text>
          </g>
        );
      })}
      <motion.circle
        cx="200" cy="168" r="6" fill="#60A5FA"
        animate={reduceMotion ? {} : { opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </svg>
  );
}