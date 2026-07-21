'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import CameraFeed from './CameraFeed';
import FacilityMiniMap from './FacilityMiniMap';
import HoldToConfirm from './ui/HoldToConfirm';
import SlideToConfirm from './ui/SlideToConfirm';
import DigitalTwin, { TwinTarget } from './DigitalTwin';
import { Panel, Field, Chip, Meter, Divider, Button, Sparkline, TONE, Tone } from './ui/Hud';
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

type Step = 1 | 2 | 3 | 4;

const STEPS: { id: Step; label: string; sub: string }[] = [
  { id: 1, label: 'Dispatch',     sub: 'Send job to cell' },
  { id: 2, label: 'Assistance',   sub: 'Anomaly surfaced' },
  { id: 3, label: 'Digital twin', sub: 'Diagnose the jam' },
  { id: 4, label: 'Recovery',     sub: 'Guided clear' },
];

// Sequence follows the standard machine-hall recovery order: confirm the
// stop category, isolate stored energy before entry, clear, then reset the
// safeguard from OUTSIDE the hazard zone (ISO 13849 requires the reset
// actuator be positioned so the operator cannot trigger it from within).
const RECOVERY = [
  {
    id: 1,
    title: 'Confirm standstill',
    detail: 'Controller is in a Category 2 stop — servo power held, brakes engaged. Verify zero-speed on the pendant before approaching the envelope.',
    ref: 'IEC 60204-1',
  },
  {
    id: 2,
    title: 'Isolate stored energy',
    detail: 'Vent pneumatic supply and confirm the arm cannot back-drive under gravity load. Apply the safeguard hold before breaking the plane.',
    ref: 'ISO 10218-2',
  },
  {
    id: 3,
    title: 'Clear and inspect',
    detail: 'Remove the skewed workpiece. Check gripper jaws and the fixture datum for debris or deformation before releasing the hold.',
    ref: '',
  },
  {
    id: 4,
    title: 'Exit, then reset safeguard',
    detail: 'Leave the envelope and close the interlock. The reset actuator sits outside the perimeter by design — it cannot be reached from inside.',
    ref: 'ISO 13849-1',
  },
];

const JOB_TYPES: JobType[] = ['inspect', 'pick-place', 'return-home', 'calibrate'];

// What a controller actually re-verifies before handing motion back:
// encoder referencing, drive/DC-bus readiness, the dual-channel safety
// circuit, and a brake hold test. Named here so the progress ring reports
// something real rather than a generic three-part bar.
const DIAG_CHECKS = [
  { label: 'Encoder referencing', th: 0.25 },
  { label: 'Drive & DC bus',      th: 0.50 },
  { label: 'Safety circuit',      th: 0.75 },
  { label: 'Brake hold test',     th: 1.00 },
];

interface Ev { id: string; ts: number; level: 'info' | 'warn' | 'error'; message: string }

function deriveJoints(cell: RobotCell) {
  const r = cell.motor.avgRms;
  const k = cell.motor.avgKurt;
  return [
    { id: 'J1', name: 'Base',     angle: 45 + r * 40, torque: 20 + r * 25, max: 180 },
    { id: 'J2', name: 'Shoulder', angle: -30 + k * 8, torque: 45 + k * 4,  max: 90 },
    { id: 'J3', name: 'Elbow',    angle: 90 + r * 20, torque: 30 + r * 15, max: 145 },
    { id: 'J4', name: 'W-rot',    angle: 15,          torque: 8,           max: 180 },
    { id: 'J5', name: 'W-pitch',  angle: -45 + k * 4, torque: 6 + k,       max: 120 },
    { id: 'J6', name: 'Gripper',  angle: cell.mode === 'manual' ? 60 : 30, torque: 12, max: 90 },
  ];
}

export default function CellConsole({
  cell, allCells, jobs, onModeChange, onStatusChange, onOpenCell, onSendJob, onMotorUpdate,
}: CellConsoleProps) {
  const reduceMotion = useReducedMotion();
  const [events, setEvents] = useState<Ev[]>([]);
  const [step, setStep] = useState<Step>(1);
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [diag, setDiag] = useState<number | null>(null);
  const [dispatched, setDispatched] = useState<{ type: JobType; at: number } | null>(null);
  const [rmsTrace, setRmsTrace] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alert = cell.status === 'assistance-required';

  useEffect(() => {
    if (alert && step === 1) setStep(2);
    if (!alert && step !== 1) {
      setStep(1); setRecoveryStep(1); setDone(new Set()); setDispatched(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const push = (level: Ev['level'], message: string) =>
    setEvents((p) => [{ id: `${Date.now()}-${Math.random()}`, ts: Date.now(), level, message }, ...p].slice(0, 30));

  useEffect(() => {
    if (!onMotorUpdate) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/motors/next-window', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ motor: cell.motor }),
        });
        if (!res.ok) return;
        onMotorUpdate((await res.json()).motor);
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [cell.motor.file, onMotorUpdate]);

  useEffect(() => {
    setRmsTrace((p) => [...p, cell.motor.avgRms].slice(-48));
  }, [cell.motor.avgRms]);

  useEffect(() => {
    const id = setInterval(() => {
      const r = cell.motor.avgRms, k = cell.motor.avgKurt;
      if (r > 0.8 || k > 6) push('warn', `Elevated ${r > 0.8 ? 'RMS' : 'kurtosis'} · ${(r > 0.8 ? r : k).toFixed(2)}`);
      else if (Math.random() < 0.3) push('info', `Window ${cell.motor.total} nominal`);
    }, 4000);
    return () => clearInterval(id);
  }, [cell.motor.avgRms, cell.motor.avgKurt, cell.motor.total]);

  const joints = useMemo(() => deriveJoints(cell), [cell]);
  const cellJobs = jobs.filter((j) => j.cellId === cell.id);

  useEffect(() => {
    if (diag === null) return;
    if (diag >= 1) {
      const t = setTimeout(() => {
        push('info', 'Diagnostic passed — autonomy restored');
        onStatusChange?.('running');
        setDiag(null);
      }, 700);
      return () => clearTimeout(t);
    }
    const start = Date.now(), from = diag;
    const id = setInterval(() => {
      const p = Math.min(1, from + (Date.now() - start) / 3000);
      setDiag(p);
      if (p >= 1) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [diag, onStatusChange]);

  const dispatch = (type: JobType) => {
    setDispatched({ type, at: Date.now() });
    onSendJob?.({ cellId: cell.id, type, priority: 'normal' });
    push('info', `Job dispatched — ${JOB_TYPE_LABELS[type]}`);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      push('error', 'Grasp planner halted — confidence 0.31');
      onStatusChange?.('assistance-required');
    }, 3200);
  };

  return (
    <motion.div
      key={cell.id}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col min-h-full bg-[#000000]"
    >
      <TopBar cell={cell} alert={alert} onModeChange={onModeChange} rmsTrace={rmsTrace} />

      <div className="flex flex-1 min-h-0">
        <StepRail step={step} alert={alert} />
        <div className="flex-1 min-w-0 p-3">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <StepDispatch key="1" cell={cell} allCells={allCells} jobs={cellJobs} joints={joints}
                events={events} dispatched={dispatched} onDispatch={dispatch}
                reduceMotion={reduceMotion} onOpenCell={onOpenCell} />
            )}
            {step === 2 && (
              <StepAlert key="2" cell={cell} dispatched={dispatched} events={events}
                onProceed={() => setStep(3)} reduceMotion={reduceMotion} />
            )}
            {step === 3 && (
              <StepTwin key="3" cell={cell} joints={joints} events={events} reduceMotion={reduceMotion}
                onBack={() => setStep(2)} onProceed={() => setStep(4)} />
            )}
            {step === 4 && (
              <StepRecovery key="4" recoveryStep={recoveryStep} done={done} diag={diag}
                reduceMotion={reduceMotion}
                onComplete={(id: number) => {
                  setDone((p) => new Set([...p, id]));
                  setRecoveryStep((p) => Math.min(RECOVERY.length, p + 1));
                  push('info', `Recovery step ${id} confirmed`);
                }}
                onResume={() => setDiag(0)} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- */

function TopBar({ cell, alert, onModeChange, rmsTrace }: {
  cell: RobotCell; alert: boolean; onModeChange: (m: CellMode) => void; rmsTrace: number[];
}) {
  const [clock, setClock] = useState('--:--:--');
  useEffect(() => {
    const t = () => setClock(new Date().toISOString().slice(11, 19));
    t();
    const id = setInterval(t, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-[46px] shrink-0 flex items-center gap-4 px-4 border-b border-[#131318] bg-[#08080B]">
      <div className="flex items-baseline gap-2.5 min-w-0">
        <span className="text-[13px] text-[#FFFFFF] font-medium tracking-[-0.01em]">{cell.name}</span>
        <span className="text-[11px] text-[#757580]">·</span>
        <span className="text-[11px] text-[#8B8B96] truncate">{cell.location}</span>
      </div>

      <Chip label={alert ? 'Assistance required' : 'Nominal'} tone={alert ? 'blue' : 'blue'} pulse={alert} />

      <div className="flex-1" />

      <div className="hidden xl:flex items-center gap-5">
        <div className="w-[80px]">
          <div className="text-[9px] text-[#757580] leading-none mb-1">RMS</div>
          <Sparkline data={rmsTrace} tone={alert ? 'blue' : 'blue'} height={16} />
        </div>
        {[
          { l: 'Battery', v: `${Math.round(cell.battery)}%` },
          { l: 'Util', v: `${cell.utilizationPct}%` },
          { l: 'Fault', v: `${cell.motor.faultPct.toFixed(1)}%` },
        ].map((m) => (
          <div key={m.l} className="text-right">
            <div className="text-[9px] text-[#757580] leading-none">{m.l}</div>
            <div className="text-[12px] font-mono text-[#A0A0AB] leading-none mt-1">{m.v}</div>
          </div>
        ))}
      </div>

      <div className="text-[11px] font-mono text-[#8B8B96]">{clock}</div>
      <ModeToggle mode={cell.mode} onChange={onModeChange} disabled={alert} />
    </div>
  );
}

function ModeToggle({ mode, onChange, disabled }: {
  mode: CellMode; onChange: (m: CellMode) => void; disabled?: boolean;
}) {
  const modes: CellMode[] = ['autonomous', 'manual', 'stopped'];
  return (
    <div className="flex gap-0.5 p-0.5 rounded-[5px] bg-[#0D0D11] border border-[#1A1A21]" role="tablist">
      {modes.map((m) => {
        const on = mode === m;
        const c = m === 'stopped' ? TONE.red : TONE.blue;
        return (
          <button
            key={m}
            onClick={() => !disabled && onChange(m)}
            disabled={disabled}
            role="tab"
            aria-selected={on}
            className="h-[22px] px-2.5 rounded-[3px] text-[10px] capitalize transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ background: on ? `${c}1F` : 'transparent', color: on ? c : '#8B8B96' }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

function StepRail({ step, alert }: { step: Step; alert: boolean }) {
  return (
    <div className="w-[176px] shrink-0 border-r border-[#131318] bg-[#08080B] p-3">
      <div className="text-[10px] text-[#757580] mb-2.5 px-1">Workflow</div>
      <div className="flex flex-col gap-0.5">
        {STEPS.map((s) => {
          const isDone = s.id < step;
          const active = s.id === step;
          const tone: Tone = active ? (alert && s.id >= 2 ? 'blue' : 'blue') : isDone ? 'green' : 'neutral';
          const c = TONE[tone];
          return (
            <div
              key={s.id}
              className="relative flex items-start gap-2.5 px-2 py-2 rounded-[5px] transition-colors"
              style={{ background: active ? `${c}12` : 'transparent' }}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full" style={{ background: c }} />
              )}
              <div
                className="w-[15px] h-[15px] shrink-0 rounded-full flex items-center justify-center text-[9px] font-mono mt-px"
                style={{
                  border: `1px solid ${active || isDone ? c : '#26262F'}`,
                  background: isDone ? c : 'transparent',
                  color: isDone ? '#000000' : active ? c : '#757580',
                }}
              >
                {isDone ? '✓' : s.id}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] leading-tight" style={{ color: active ? '#FFFFFF' : isDone ? '#A0A0AB' : '#757580' }}>
                  {s.label}
                </div>
                <div className="text-[9px] text-[#757580] leading-tight mt-0.5">{s.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function StepDispatch({ cell, allCells, jobs, joints, events, dispatched, onDispatch, reduceMotion, onOpenCell }: any) {
  const [sel, setSel] = useState<JobType>('pick-place');
  const pending = dispatched !== null;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="grid grid-cols-[300px_1fr_280px] gap-3 h-full"
    >
      <div className="flex flex-col gap-3 min-h-0">
        <Panel label="Dispatch" tone="blue" accentEdge right="Step 01">
          <div className="text-[11px] text-[#8B8B96] leading-relaxed mb-3">
            Select a task profile and send it to {cell.name}.
          </div>
          <div className="flex flex-col gap-1">
            {JOB_TYPES.map((t: JobType) => {
              const on = sel === t;
              return (
                <button
                  key={t}
                  onClick={() => setSel(t)}
                  disabled={pending}
                  aria-pressed={on}
                  className="h-[34px] px-3 rounded-[5px] flex items-center justify-between transition-colors disabled:opacity-40 disabled:cursor-not-allowed row-hover"
                  style={{
                    background: on ? `${TONE.blue}16` : 'transparent',
                    border: `1px solid ${on ? `${TONE.blue}4D` : '#1A1A21'}`,
                  }}
                >
                  <span className="text-[12px]" style={{ color: on ? TONE.blue : '#A0A0AB' }}>
                    {JOB_TYPE_LABELS[t]}
                  </span>
                  {on && <span className="w-1.5 h-1.5 rounded-full" style={{ background: TONE.blue }} />}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            {pending ? (
              <div className="h-[42px] rounded-[5px] flex items-center gap-2.5 px-3"
                style={{ background: `${TONE.blue}12`, border: `1px solid ${TONE.blue}38` }}>
                <motion.span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TONE.blue }}
                  animate={reduceMotion ? {} : { opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }} />
                <div className="min-w-0">
                  <div className="text-[11px] truncate" style={{ color: TONE.blue }}>
                    Executing · {JOB_TYPE_LABELS[dispatched.type]}
                  </div>
                  <div className="text-[9px] text-[#757580]">Monitoring grasp confidence</div>
                </div>
              </div>
            ) : (
              <Button onClick={() => onDispatch(sel)} tone="blue" size="lg" full>
                Dispatch job
              </Button>
            )}
          </div>
        </Panel>

        <Panel label="Queue" right={`${jobs.length}`} padded={false}>
          {jobs.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-[#757580]">No active jobs</div>
          ) : (
            jobs.map((j: Job) => (
              <div key={j.id} className="h-[32px] px-3 flex items-center justify-between border-b border-[#131318] last:border-b-0 row-hover">
                <span className="text-[11px] text-[#A0A0AB]">{JOB_TYPE_LABELS[j.type]}</span>
                <span className="text-[10px] font-mono" style={{
                  color: j.status === 'running' ? TONE.blue : j.status === 'done' ? TONE.white : j.status === 'failed' ? TONE.red : '#757580',
                }}>
                  {j.status}
                </span>
              </div>
            ))
          )}
        </Panel>
        <div className="flex-1" />
      </div>

      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex-1 min-h-[280px] rounded-[7px] overflow-hidden border border-[#1A1A21]">
          <CameraFeed cell={cell} size="large" />
        </div>
        <Telemetry joints={joints} />
      </div>

      <div className="flex flex-col gap-3 min-h-0">
        <Panel label="Position">
          <FacilityMiniMap cells={allCells} highlightCellId={cell.id} onCellClick={onOpenCell} compact />
        </Panel>
        <EventLog events={events} reduceMotion={reduceMotion} />
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- */

function StepAlert({ cell, dispatched, events, onProceed, reduceMotion }: any) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="grid grid-cols-[1fr_280px] gap-3 h-full"
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-[7px] border bg-[#08080B] overflow-hidden"
          style={{ borderColor: `${TONE.blue}3D` }}>
          <div className="h-px" style={{ background: `linear-gradient(90deg, ${TONE.blue}80, transparent 60%)` }} />
          <div className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <motion.span className="w-1.5 h-1.5 rounded-full" style={{ background: TONE.blue }}
                animate={reduceMotion ? {} : { opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }} />
              <span className="text-[10px]" style={{ color: TONE.blue }}>Human intervention required</span>
            </div>

            <h2 className="text-[26px] font-medium tracking-[-0.02em] leading-tight" style={{ color: TONE.blue }}>
              Assistance required
            </h2>

            <p className="text-[12px] text-[#A0A0AB] leading-relaxed mt-3 max-w-xl">
              {cell.name} halted during{' '}
              <span className="text-[#FFFFFF] font-mono">
                {dispatched ? JOB_TYPE_LABELS[dispatched.type] : 'execution'}
              </span>. The vision stack resolved a misaligned workpiece and the grasp planner
              dropped below its confidence floor. Actuators are holding position.
            </p>

            <div className="grid grid-cols-3 gap-2 mt-5">
              {[
                { l: 'Grasp confidence', v: '0.31', s: 'floor 0.75' },
                { l: 'Halted', v: '00:42', s: 'since detect' },
                { l: 'Skew', v: '15°', s: 'tolerance ±3°' },
              ].map((m) => (
                <div key={m.l} className="rounded-[5px] px-3 py-2.5"
                  style={{ background: `${TONE.blue}0A`, border: `1px solid ${TONE.blue}24` }}>
                  <Field label={m.l} value={m.v} tone="blue" size="xl" />
                  <div className="text-[9px] text-[#757580] mt-1.5">{m.s}</div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <Button onClick={onProceed} tone="blue" size="lg" full>
                Open digital twin →
              </Button>
              <div className="text-[10px] text-[#757580] text-center mt-2">
                Inspect the anomaly before intervening
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1" />
      </div>

      <EventLog events={events} reduceMotion={reduceMotion} />
    </motion.div>
  );
}

/* ---------------------------------------------------------------- */

interface ParamCard { id: string; label: string; value: string; delta: string; target: TwinTarget; tone: Tone }

function StepTwin({ cell, joints, events, reduceMotion, onBack, onProceed }: any) {
  const [sel, setSel] = useState<string | null>(null);

  const params: ParamCard[] = [
    { id: 'gripper',   label: 'Gripper width',  value: '48mm', delta: 'target 42mm', target: 'gripper',   tone: 'blue' },
    { id: 'workpiece', label: 'Workpiece skew', value: '15°',  delta: 'tolerance ±3°', target: 'workpiece', tone: 'blue' },
    { id: 'joint2',    label: 'J2 shoulder',    value: `${joints[1].angle.toFixed(1)}°`, delta: `${joints[1].torque.toFixed(1)} Nm`, target: 'joint2', tone: 'blue' },
    { id: 'base',      label: 'Base rotation',  value: `${joints[0].angle.toFixed(1)}°`, delta: `${joints[0].torque.toFixed(1)} Nm`, target: 'base', tone: 'blue' },
  ];
  const active = params.find((p) => p.id === sel);

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="grid grid-cols-[1fr_280px] gap-3 h-full"
    >
      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex-1 min-h-[300px] rounded-[7px] overflow-hidden border"
          style={{ borderColor: active ? `${TONE[active.tone]}45` : `${TONE.blue}30` }}>
          <DigitalTwin cell={cell} focusTarget={active?.target ?? null}
            auraColor={active ? TONE[active.tone] : TONE.blue} />
        </div>

        <div>
          <Divider label="Parameters — select to isolate in view" />
          <div className="grid grid-cols-4 gap-2 mt-2">
            {params.map((p) => {
              const on = p.id === sel;
              const c = TONE[p.tone];
              return (
                <button
                  key={p.id}
                  onClick={() => setSel(on ? null : p.id)}
                  aria-pressed={on}
                  className="rounded-[6px] px-3 py-2.5 text-left transition-all duration-150"
                  style={{
                    background: on ? `${c}14` : '#08080B',
                    border: `1px solid ${on ? `${c}5C` : '#1A1A21'}`,
                    boxShadow: on ? `0 0 0 1px ${c}22, 0 2px 12px ${c}1F` : undefined,
                  }}
                >
                  <Field label={p.label} value={p.value} tone={on ? p.tone : 'neutral'} size="lg" />
                  <div className="text-[9px] mt-1.5" style={{ color: on ? `${c}CC` : '#757580' }}>{p.delta}</div>
                </button>
              );
            })}
          </div>
        </div>

        <Telemetry joints={joints} frozen />

        <div className="grid grid-cols-[100px_1fr] gap-2">
          <Button onClick={onBack} variant="outline" size="lg">← Back</Button>
          <Button onClick={onProceed} tone="blue" size="lg" full>Begin recovery →</Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 min-h-0">
        <Panel label="Diagnosis" tone="blue" accentEdge>
          <p className="text-[11px] text-[#A0A0AB] leading-relaxed">
            Twin reconstructed from the perception stack. A workpiece entered the pick zone
            rotated 15° from expected orientation, outside the grasp planner's tolerance band.
          </p>
        </Panel>
        <EventLog events={events} reduceMotion={reduceMotion} />
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- */

function StepRecovery({ recoveryStep, done, onComplete, onResume, diag, reduceMotion }: any) {
  const idx = Math.min(RECOVERY.length - 1, Math.max(0, recoveryStep - 1));
  const active = RECOVERY[idx];
  const allDone = done.size === RECOVERY.length;
  const inDiag = diag !== null;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="grid grid-cols-[1fr_400px] gap-3 h-full"
    >
      <div className="flex flex-col gap-3 min-w-0">
        <Divider label={`Visual guide — step ${active.id} of ${RECOVERY.length}`} />
        <div className="flex-1 min-h-[300px] rounded-[7px] overflow-hidden border"
          style={{ borderColor: `${TONE.blue}30` }}>
          {inDiag
            ? <DiagAnim progress={diag} reduceMotion={reduceMotion} />
            : <StepAnim id={active.id} reduceMotion={reduceMotion} />}
        </div>
        <Panel>
          <div className="text-[10px] text-[#757580]">Active step</div>
          <div className="text-[14px] text-[#FFFFFF] mt-1.5 tracking-[-0.01em]">{active.title}</div>
          <div className="text-[11px] text-[#8B8B96] mt-1.5 leading-relaxed">{active.detail}</div>
        </Panel>
      </div>

      <div className="rounded-[7px] border bg-[#08080B] flex flex-col overflow-hidden"
        style={{ borderColor: `${TONE.blue}3D` }}>
        <div className="h-px" style={{ background: `linear-gradient(90deg, ${TONE.blue}80, transparent 60%)` }} />
        <div className="h-[34px] px-3 flex items-center justify-between border-b border-[#131318]">
          <span className="text-[11px]" style={{ color: TONE.blue }}>Recovery checklist</span>
          <span className="text-[10px] font-mono text-[#8B8B96]">{done.size} / {RECOVERY.length}</span>
        </div>

        <div className="p-2.5 flex flex-col gap-1.5 flex-1 overflow-y-auto">
          {RECOVERY.map((s) => {
            const isDone = done.has(s.id);
            const current = s.id === active.id && !isDone && !inDiag;
            const c = isDone ? TONE.white : current ? TONE.blue : '#26262F';
            return (
              <div key={s.id} className="rounded-[6px] px-3 py-2.5 transition-colors"
                style={{
                  background: current ? `${TONE.blue}0D` : isDone ? `${TONE.white}08` : 'transparent',
                  border: `1px solid ${isDone ? `${TONE.white}2E` : current ? `${TONE.blue}52` : '#1A1A21'}`,
                }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-[18px] h-[18px] shrink-0 rounded-full flex items-center justify-center text-[9px] font-mono mt-px"
                    style={{
                      border: `1px solid ${c}`,
                      background: isDone ? TONE.white : 'transparent',
                      color: isDone ? '#000000' : current ? TONE.blue : '#757580',
                    }}>
                    {isDone ? '✓' : s.id}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] leading-tight"
                      style={{ color: isDone ? '#8B8B96' : current ? '#FFFFFF' : '#757580' }}>
                      {s.title}
                    </div>
                    <div className="text-[10px] text-[#757580] mt-1 leading-relaxed">{s.detail}</div>
                    {s.ref && current && (
                      <div className="text-[9px] font-mono text-[#757580] mt-1.5">{s.ref}</div>
                    )}
                    {current && (
                      <div className="mt-2.5">
                        <SlideToConfirm onConfirm={() => onComplete(s.id)} label="Slide to confirm" intent="warn" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[#131318] p-4">
          {inDiag ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-[#A0A0AB]">Verifying</span>
                <span className="text-[11px] font-mono" style={{ color: TONE.blue }}>
                  {Math.round((diag ?? 0) * 100)}%
                </span>
              </div>
              <Meter value={diag ?? 0} tone="blue" height={2} />
              <div className="mt-2 text-[10px] font-mono text-[#8B8B96]">
                {(DIAG_CHECKS.find((c) => (diag ?? 0) < c.th) ?? DIAG_CHECKS[DIAG_CHECKS.length - 1]).label}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <HoldToConfirm onConfirm={onResume} label="Resume" sublabel="autonomy"
                intent="safe" disabled={!allDone} icon={<span aria-hidden="true">▶</span>} />
              <div className="text-[10px] text-[#757580] mt-6">
                {allDone ? 'Hold 1.5s to authorise' : `${RECOVERY.length - done.size} steps remaining`}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- */

function Telemetry({ joints, frozen }: { joints: any[]; frozen?: boolean }) {
  return (
    <Panel label="Joint telemetry" right={frozen ? 'captured' : 'live · 6 axes'} padded={false}>
      <div className="grid grid-cols-6">
        {joints.map((j: any) => {
          const travel = Math.abs(j.angle) / j.max;
          const load = j.torque / 60;
          return (
            <div key={j.id} className="px-3 py-2.5 border-r border-[#131318] last:border-r-0">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-[#8B8B96]">{j.id}</span>
                <span className="text-[9px] text-[#757580]">{j.name}</span>
              </div>
              <div className="text-[14px] font-mono text-[#FFFFFF] mt-1.5 leading-none">
                {j.angle.toFixed(1)}<span className="text-[#757580]">°</span>
              </div>
              <div className="mt-2"><Meter value={travel} tone={load > 0.75 ? 'blue' : 'blue'} /></div>
              <div className="text-[10px] font-mono text-[#8B8B96] mt-2 leading-none">
                {j.torque.toFixed(1)}<span className="text-[#757580]"> Nm</span>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function EventLog({ events, reduceMotion }: { events: Ev[]; reduceMotion: boolean | null }) {
  return (
    <Panel label="Event log" right={`${events.length}`} padded={false} className="flex-1 min-h-0 flex flex-col">
      <div className="overflow-y-auto flex-1" style={{ maxHeight: 340 }}>
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-[#757580]">Listening…</div>
          ) : events.map((ev) => {
            const c = ev.level === 'error' ? TONE.red : ev.level === 'warn' ? TONE.blue : '#757580';
            return (
              <motion.div
                key={ev.id}
                initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="px-3 py-2 flex items-baseline gap-2 border-b border-[#131318] last:border-b-0 row-hover"
              >
                <span className="w-1 h-1 rounded-full shrink-0" style={{ background: c }} />
                <span className="text-[11px] text-[#A0A0AB] flex-1 truncate leading-tight">{ev.message}</span>
                <span className="text-[10px] font-mono text-[#757580] shrink-0">
                  {new Date(ev.ts).toISOString().slice(11, 19)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- */

function AnimShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-full bg-[#08080B]">
      <defs>
        <pattern id="cc-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#131318" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="400" height="300" fill="url(#cc-grid)" />
      <text x="16" y="24" fontSize="11" fill="#4DB8FF" fontFamily="var(--font-sans)">{title}</text>
      <text x="16" y="38" fontSize="9" fill="#8B8B96" fontFamily="var(--font-sans)">{sub}</text>
      {children}
    </svg>
  );
}

function StepAnim({ id, reduceMotion }: { id: number; reduceMotion: boolean | null }) {
  const t = reduceMotion
    ? { duration: 0 }
    : { duration: 3, repeat: Infinity, ease: 'easeInOut' as const, times: [0, 0.4, 0.7, 1] };

  if (id === 1) return (
    <AnimShell title="Safing — arm retract" sub="Await full retraction before entering">
      <rect x="182" y="72" width="36" height="14" rx="2" fill="#26262F" />
      <motion.g animate={reduceMotion ? {} : { rotate: [30, 0, 0, 30] }} transition={t} style={{ transformOrigin: '200px 86px' }}>
        <rect x="196" y="86" width="8" height="76" rx="3" fill="#757580" />
        <circle cx="200" cy="162" r="5.5" fill="#4DB8FF" />
        <motion.g animate={reduceMotion ? {} : { rotate: [40, 0, 0, 40] }} transition={t} style={{ transformOrigin: '200px 162px' }}>
          <rect x="196" y="162" width="8" height="50" rx="3" fill="#757580" />
          <rect x="189" y="210" width="22" height="7" rx="2" fill="#FFFFFF" />
        </motion.g>
      </motion.g>
      <motion.circle cx="200" cy="130" r="62" fill="none" stroke="#4DB8FF" strokeWidth="1" strokeDasharray="2 5"
        animate={reduceMotion ? {} : { opacity: [0.2, 0.55, 0.2] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
    </AnimShell>
  );

  if (id === 2) return (
    <AnimShell title="Realign — 15° to 0°" sub="Rotate the workpiece to the fixture guides">
      <rect x="142" y="122" width="2.5" height="118" rx="1" fill="#26262F" />
      <rect x="256" y="122" width="2.5" height="118" rx="1" fill="#26262F" />
      <rect x="120" y="244" width="160" height="5" rx="2" fill="#1A1A21" />
      <motion.g animate={reduceMotion ? {} : { rotate: [15, 0, 0, 15] }} transition={t} style={{ transformOrigin: '200px 180px' }}>
        <rect x="152" y="163" width="96" height="34" rx="3" fill="#26262F" stroke="#757580" strokeWidth="1" />
        <circle cx="200" cy="180" r="2.5" fill="#4DB8FF" />
      </motion.g>
      <motion.g animate={reduceMotion ? {} : { x: [14, -4, -4, 14] }} transition={t}>
        <path d="M 286 174 L 296 174 L 296 179 L 301 179 L 301 174 L 306 174 L 306 194 L 286 194 Z" fill="#4DB8FF" />
      </motion.g>
    </AnimShell>
  );

  if (id === 3) return (
    <AnimShell title="Verify — conveyor path" sub="Sweep upstream and downstream">
      <rect x="40" y="144" width="320" height="26" rx="3" fill="#08080B" stroke="#1A1A21" />
      {Array.from({ length: 15 }).map((_, i) => (
        <line key={i} x1={54 + i * 21} y1="148" x2={54 + i * 21} y2="166" stroke="#1A1A21" strokeWidth="0.5" />
      ))}
      <rect x="182" y="149" width="36" height="16" rx="2" fill="#26262F" stroke="#757580" />
      <motion.rect x="52" y="134" width="7" height="46" rx="3" fill="#4DB8FF" fillOpacity={0.3}
        animate={reduceMotion ? {} : { x: [52, 340, 52] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 3.4, repeat: Infinity, ease: 'linear' }} />
      {[82, 134, 186, 242, 294, 342].map((x, i) => (
        <motion.text key={i} x={x} y="126" fontSize="11" fill="#FFFFFF" textAnchor="middle"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={reduceMotion ? {} : { opacity: [0, 0, 1, 1, 0] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 3.4, repeat: Infinity, times: [0, i * 0.15, i * 0.15 + 0.04, 0.94, 1] }}
        >✓</motion.text>
      ))}
      <text x="42" y="194" fontSize="9" fill="#757580" fontFamily="var(--font-sans)">← upstream</text>
      <text x="358" y="194" fontSize="9" fill="#757580" textAnchor="end" fontFamily="var(--font-sans)">downstream →</text>
    </AnimShell>
  );

  return (
    <AnimShell title="Clear — safety perimeter" sub="Minimum standoff 1 metre">
      <rect x="146" y="94" width="108" height="104" rx="4" fill="none" stroke="#26262F" strokeWidth="1.5" />
      <text x="200" y="150" fontSize="9" fill="#757580" textAnchor="middle" fontFamily="var(--font-sans)">cell</text>
      <motion.rect x="86" y="36" width="228" height="220" rx="6" fill="none" stroke="#4DB8FF" strokeWidth="1" strokeDasharray="4 5"
        animate={reduceMotion ? {} : { opacity: [0.25, 0.7, 0.25] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.g
        animate={reduceMotion ? {} : { x: [0, 108, 108, 0] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 3.6, repeat: Infinity, ease: 'easeInOut', times: [0, 0.4, 0.7, 1] }}>
        <circle cx="200" cy="142" r="5.5" fill="#4DB8FF" />
        <rect x="196.5" y="148" width="7" height="17" rx="2" fill="#4DB8FF" />
        <line x1="200" y1="165" x2="196" y2="177" stroke="#4DB8FF" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="200" y1="165" x2="204" y2="177" stroke="#4DB8FF" strokeWidth="1.8" strokeLinecap="round" />
      </motion.g>
    </AnimShell>
  );
}

function DiagAnim({ progress, reduceMotion }: { progress: number; reduceMotion: boolean | null }) {
  const rings = [92, 74, 56, 38];
  const activeIdx = DIAG_CHECKS.findIndex((c) => progress < c.th);
  const active = activeIdx === -1 ? DIAG_CHECKS[DIAG_CHECKS.length - 1] : DIAG_CHECKS[activeIdx];

  return (
    <svg viewBox="0 0 400 300" className="w-full h-full bg-black">
      <rect width="400" height="300" fill="url(#cc-grid)" />

      {rings.map((r, i) => {
        const th = DIAG_CHECKS[i].th;
        const prev = i === 0 ? 0 : DIAG_CHECKS[i - 1].th;
        const local = Math.max(0, Math.min(1, (progress - prev) / (th - prev)));
        const circ = 2 * Math.PI * r;
        return (
          <g key={r}>
            <circle cx="200" cy="150" r={r} fill="none" stroke="#131318" strokeWidth="1" />
            <circle
              cx="200" cy="150" r={r} fill="none"
              stroke={progress >= th ? '#FFFFFF' : '#4DB8FF'}
              strokeWidth="1.5"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - local)}
              transform="rotate(-90 200 150)"
            />
          </g>
        );
      })}

      <motion.circle
        cx="200" cy="150" r="3" fill="#4DB8FF"
        animate={reduceMotion ? {} : { opacity: [1, 0.2, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <text x="200" y="284" fontSize="10" fill="#A0A0AB" textAnchor="middle" fontFamily="var(--font-mono)">
        {active.label}
      </text>
    </svg>
  );
}