'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import DraggableSignalTrace from './DraggableSignalTrace';
import SeverityBadge from './SeverityBadge';
import { statusToSeverity } from '../lib/severity';
import { toDeviationIndex } from '../lib/normalize';
import { Motor } from '../lib/types';

interface MotorInspectorProps {
  motor: Motor | null;
}

type ActionState = 'none' | 'acknowledged' | 'scheduled' | 'escalated';

const ACTION_COPY: Record<Exclude<ActionState, 'none'>, string> = {
  acknowledged: 'Marked as reviewed — no further action logged.',
  scheduled: 'Inspection scheduled — this motor will surface on the maintenance queue.',
  escalated: 'Escalated — notified the on-call maintenance lead.',
};

export default function MotorInspector({ motor }: MotorInspectorProps) {
  const [action, setAction] = useState<ActionState>('none');
  const reduceMotion = useReducedMotion();

  if (!motor) {
    return (
      <div className="p-10 text-slate-500 font-mono text-sm">
        Select a motor from Fleet Console to inspect it.
      </div>
    );
  }

  const overall = statusToSeverity(motor.status);
  const rmsHistory = toDeviationIndex(motor.windows.map((w) => Number(w.rms) || 0));
  const kurtosisHistory = toDeviationIndex(motor.windows.map((w) => Number(w.kurtosis) || 0));
  const topContributor = motor.avgKurt >= motor.avgRms * 3 ? 'kurtosis' : 'rms';

  return (
    <motion.div
      key={motor.file}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
      className="p-8 max-w-[760px] font-sans text-slate-100"
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-[22px] font-semibold m-0">{motor.name}</h1>
          <span className="font-mono text-xs text-slate-500">
            {motor.faults} of {motor.total} windows flagged · {motor.faultPct.toFixed(1)}%
          </span>
        </div>
        <SeverityBadge level={overall} />
      </div>

      <div className="flex flex-col gap-4">
        <DraggableSignalTrace
          label="RMS amplitude"
          unit="index"
          history={rmsHistory}
          isTopContributor={topContributor === 'rms'}
        />
        <DraggableSignalTrace
          label="Kurtosis"
          unit="index"
          history={kurtosisHistory}
          isTopContributor={topContributor === 'kurtosis'}
        />
      </div>

      <div className="flex gap-2.5 mt-6">
        <ActionButton label="Acknowledge" active={action === 'acknowledged'} onClick={() => setAction('acknowledged')} />
        <ActionButton label="Schedule inspection" active={action === 'scheduled'} onClick={() => setAction('scheduled')} />
        <ActionButton label="Escalate" active={action === 'escalated'} onClick={() => setAction('escalated')} danger />
      </div>

      <AnimatePresence mode="wait">
        {action !== 'none' && (
          <motion.p
            key={action}
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
            className="font-mono text-xs text-slate-500 mt-2.5 overflow-hidden"
          >
            {ACTION_COPY[action]}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ActionButton({
  label,
  active,
  onClick,
  danger = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const activeClasses = danger
    ? 'border-[#FF5D5D] bg-[#FF5D5D]/10 text-[#FF5D5D]'
    : 'border-[#4FD1C5] bg-[#4FD1C5]/10 text-[#4FD1C5]';

  return (
    <motion.button
      onClick={onClick}
      whileTap={reduceMotion ? undefined : { scale: 0.95 }}
      className={`font-mono text-xs px-3.5 py-2 rounded border transition-colors ${
        active ? activeClasses : 'border-[#262c38] text-slate-100 hover:border-slate-600'
      }`}
    >
      {label}
    </motion.button>
  );
}