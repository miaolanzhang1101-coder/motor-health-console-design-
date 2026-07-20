'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { RobotCell, CellStatus } from '../lib/cells';

interface RecoveryFlowProps {
  cell: RobotCell;
  onStatusChange: (status: CellStatus) => void;
  phase?: RecoveryPhase;
  onPhaseChange?: (p: RecoveryPhase) => void;
}

type RecoveryPhase = 'alert' | 'paused' | 'guiding' | 'diagnostic' | 'optimal' | 'synced';

const RECOVERY_STEPS = [
  { id: 1, title: 'Approach the workpiece safely', detail: 'Wait for the arm to complete its retraction before entering the cell.' },
  { id: 2, title: 'Manually realign the workpiece', detail: 'Rotate the workpiece to match the fixture guides on the conveyor.' },
  { id: 3, title: 'Verify no obstructions remain', detail: 'Check the conveyor belt path is clear in both directions.' },
  { id: 4, title: 'Step outside the safety perimeter', detail: 'Move at least 1m away from the cell before resuming autonomy.' },
];

export default function RecoveryFlow({ cell, onStatusChange, phase: controlledPhase, onPhaseChange }: RecoveryFlowProps) {
  const reduceMotion = useReducedMotion();
  const [internalPhase, setInternalPhase] = useState<RecoveryPhase>('alert');
  const phase = controlledPhase ?? internalPhase;
  const setPhase = (p: RecoveryPhase) => {
    setInternalPhase(p);
    onPhaseChange?.(p);
  };
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [diagnosticProgress, setDiagnosticProgress] = useState(0);

  // Diagnostic timer — 3 seconds
  useEffect(() => {
    if (phase !== 'diagnostic') return;
    setDiagnosticProgress(0);
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / 3000);
      setDiagnosticProgress(p);
      if (p >= 1) {
        clearInterval(id);
        setPhase('optimal');
      }
    }, 50);
    return () => clearInterval(id);
  }, [phase]);

  // After 'optimal' shows for 2.5s, transition to 'synced' + flip the status
  useEffect(() => {
    if (phase !== 'optimal') return;
    const t = setTimeout(() => {
      setPhase('synced');
      onStatusChange('running');
    }, 2500);
    return () => clearTimeout(t);
  }, [phase, onStatusChange]);

  const cellNum = cell.name.replace('Cell ', '#');

  return (
    <div
      className="border-2 border-[#F59E0B]/60 bg-[#F59E0B]/5 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]"
      role="alert"
      aria-live="polite"
    >
      {/* Big header — impossible to miss */}
      <div className="px-5 py-4 border-b border-[#F59E0B]/30 bg-[#F59E0B]/10">
        <div className="flex items-center gap-3 mb-1">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F59E0B] opacity-70" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#F59E0B]" />
          </span>
          <h2 className="text-lg font-mono font-bold text-[#F59E0B] tracking-wide">
            ASSISTANCE REQUIRED
          </h2>
        </div>
        <div className="text-[12px] font-mono text-[#D7D9E0]">
          {cellNum} · misaligned workpiece detected · VLA confidence dropped below threshold
        </div>
      </div>

      {/* Phase-based content */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          {phase === 'alert' && (
            <motion.div
              key="alert"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4"
            >
              <div className="text-[13px] font-mono text-[#D7D9E0] leading-relaxed">
                Before you can intervene, the actuators must be safed. Tap the button below to freeze
                every mechanical joint on this cell.
              </div>
              <button
                onClick={() => setPhase('paused')}
                className="w-full text-lg font-mono uppercase tracking-wide px-6 py-5 border-2 border-[#F59E0B] bg-[#F59E0B]/20 text-[#F59E0B] hover:bg-[#F59E0B]/30 transition-colors font-bold flex items-center justify-center gap-2"
              >
                <span aria-hidden="true">⏸</span> Safe Pause
              </button>
              <div className="text-[10px] font-mono text-[#7C8090] text-center">
                Step 9 · Freezes physical actuators and mechanical joints
              </div>
            </motion.div>
          )}

          {phase === 'paused' && (
            <motion.div
              key="paused"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center gap-2 py-2 px-3 bg-[#818CF8]/10 border border-[#818CF8]/30">
                <span className="text-[#818CF8]">◐</span>
                <span className="text-[12px] font-mono text-[#818CF8] font-semibold">
                  Actuators safely frozen · safe to intervene
                </span>
              </div>
              <div className="text-[13px] font-mono text-[#D7D9E0] leading-relaxed">
                All mechanical joints are locked. The floor is safe.
                Follow the 4-step recovery guide to clear the jam.
              </div>
              <button
                onClick={() => setPhase('guiding')}
                className="w-full text-base font-mono uppercase tracking-wide px-6 py-4 border-2 border-[#3B82F6] bg-[#3B82F6]/20 text-[#3B82F6] hover:bg-[#3B82F6]/30 transition-colors font-bold"
              >
                Show recovery guide
              </button>
            </motion.div>
          )}

          {phase === 'guiding' && (
            <motion.div
              key="guiding"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-mono uppercase tracking-wide text-[#4A4E5C]">
                  Recovery Guide
                </span>
                <span className="text-[11px] font-mono text-[#7C8090] tabular-nums">
                  {completedSteps.size} of {RECOVERY_STEPS.length} complete
                </span>
              </div>

              {RECOVERY_STEPS.map((step, i) => {
                const isDone = completedSteps.has(step.id);
                const isCurrent = i === currentStep && !isDone;
                return (
                  <div
                    key={step.id}
                    className="border transition-colors"
                    style={{
                      borderColor: isDone ? '#475569' : isCurrent ? '#3B82F6' : '#1E212A',
                      background: isCurrent ? '#3B82F60D' : 'transparent',
                    }}
                  >
                    <button
                      onClick={() => {
                        if (isCurrent) {
                          setCompletedSteps((prev) => new Set([...prev, step.id]));
                          setCurrentStep((prev) => Math.min(RECOVERY_STEPS.length - 1, prev + 1));
                        }
                      }}
                      disabled={!isCurrent}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left disabled:cursor-default"
                      aria-label={`Step ${step.id}: ${step.title}${isDone ? ' (completed)' : isCurrent ? ' (current)' : ' (pending)'}`}
                    >
                      <div
                        className="w-7 h-7 border-2 flex items-center justify-center shrink-0 text-sm font-mono font-bold"
                        style={{
                          borderColor: isDone ? '#475569' : isCurrent ? '#3B82F6' : '#2A2E3A',
                          color: isDone ? '#D7D9E0' : isCurrent ? '#3B82F6' : '#4A4E5C',
                          background: isDone ? '#475569' : 'transparent',
                        }}
                      >
                        {isDone ? '✓' : step.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[13px] font-mono font-semibold"
                          style={{ color: isDone ? '#7C8090' : isCurrent ? '#D7D9E0' : '#4A4E5C' }}
                        >
                          {step.title}
                        </div>
                        <div className="text-[11px] font-mono text-[#7C8090] mt-1 leading-relaxed">
                          {step.detail}
                        </div>
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] font-mono uppercase text-[#3B82F6] shrink-0 self-center px-2 py-1 border border-[#3B82F6]">
                          Mark done
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}

              {completedSteps.size === RECOVERY_STEPS.length && (
                <motion.button
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setPhase('diagnostic')}
                  className="w-full text-lg font-mono uppercase tracking-wide px-6 py-5 border-2 border-[#3B82F6] bg-[#3B82F6]/20 text-[#3B82F6] hover:bg-[#3B82F6]/30 transition-colors font-bold flex items-center justify-center gap-2 mt-2"
                >
                  <span aria-hidden="true">▶</span> Resume Autonomy
                </motion.button>
              )}
            </motion.div>
          )}

          {phase === 'diagnostic' && (
            <motion.div
              key="diagnostic"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              <div className="text-[13px] font-mono text-[#3B82F6] font-semibold mb-1">
                Running 3-second diagnostic check…
              </div>
              <div className="w-full h-2 bg-[#1E212A] overflow-hidden">
                <motion.div
                  className="h-full bg-[#3B82F6]"
                  initial={{ width: '0%' }}
                  animate={{ width: `${diagnosticProgress * 100}%` }}
                  transition={{ duration: 0.1, ease: 'linear' }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <DiagnosticCheck label="Perception" done={diagnosticProgress > 0.33} />
                <DiagnosticCheck label="Actuators" done={diagnosticProgress > 0.66} />
                <DiagnosticCheck label="Safety" done={diagnosticProgress >= 1} />
              </div>
            </motion.div>
          )}

          {phase === 'optimal' && (
            <motion.div
              key="optimal"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-3 py-3 px-4 bg-[#22C55E]/10 border-2 border-[#22C55E]/40">
                <span className="text-[#22C55E] text-2xl leading-none">✓</span>
                <div>
                  <div className="text-[14px] font-mono font-bold text-[#22C55E]">
                    OPTIMAL
                  </div>
                  <div className="text-[11px] font-mono text-[#7C8090]">
                    Diagnostic passed · autonomy resumed
                  </div>
                </div>
              </div>
              <div className="text-[11px] font-mono text-[#7C8090] leading-relaxed">
                LED light strips shifting to breathing green.
                Downtime metrics being pushed to the Main Console.
              </div>
            </motion.div>
          )}

          {phase === 'synced' && (
            <motion.div
              key="synced"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-3 py-3 px-4 bg-[#22C55E]/10 border-2 border-[#22C55E]/40">
                <span className="text-[#22C55E] text-2xl leading-none">✓</span>
                <div>
                  <div className="text-[14px] font-mono font-bold text-[#22C55E]">
                    RECOVERY COMPLETE
                  </div>
                  <div className="text-[11px] font-mono text-[#7C8090]">
                    Resolution synced to Main Console cloud database
                  </div>
                </div>
              </div>
              <div className="text-[11px] font-mono text-[#7C8090] space-y-1">
                <div>• Timestamp: {new Date().toLocaleString()}</div>
                <div>• Downtime: 2m 14s</div>
                <div>• Root cause: workpiece misalignment (15° skew)</div>
                <div>• LED strips: breathing green across floor</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DiagnosticCheck({ label, done }: { label: string; done: boolean }) {
  return (
    <div
      className="border px-3 py-2 flex items-center gap-2 transition-colors"
      style={{
        borderColor: done ? '#3B82F6' : '#1E212A',
        color: done ? '#3B82F6' : '#4A4E5C',
        background: done ? '#3B82F60D' : 'transparent',
      }}
    >
      <span className="text-sm font-bold">{done ? '✓' : '·'}</span>
      <span className="text-[11px] font-mono">{label}</span>
    </div>
  );
}