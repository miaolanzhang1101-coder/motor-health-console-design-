'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ComparisonChart from './ComparisonChart';
import DraggableSignalTrace from './DraggableSignalTrace';
import MultimodalPanel from './MultimodalPanel';
import RangeSlider from './ui/RangeSlider';
import Button from './ui/Button';
import StatCard from './ui/StatCard';
import { statusToSeverity, SeverityLevel, SEVERITY_COLORS, SEVERITY_LABELS } from '../lib/severity';
import { toDeviationIndex } from '../lib/normalize';
import { Motor, ActionState } from '../lib/types';
import { ThresholdValues, ThresholdNode } from '../lib/thresholdTree';

interface MotorInspectorProps {
  motor: Motor | null;
  action: ActionState;
  onActionChange: (action: ActionState) => void;
  thresholds: ThresholdValues;
  hasOwnOverride?: boolean;
  onThresholdOverrideChange?: (override: ThresholdValues | null) => void;
  thresholdAncestry?: ThresholdNode[];
}

const ACTION_COPY: Record<Exclude<ActionState, 'none'>, string> = {
  acknowledged: 'MARKED AS REVIEWED — no further action logged.',
  scheduled: 'INSPECTION SCHEDULED — surfaces on the maintenance queue.',
  escalated: 'ESCALATED — on-call maintenance lead notified.',
};

const SERIES_META = [
  { key: 'rms', label: 'RMS Amplitude', color: '#22D3EE', field: 'rms' as const },
  { key: 'kurtosis', label: 'Kurtosis', color: '#A78BFA', field: 'kurtosis' as const },
  { key: 'crest', label: 'Crest Factor', color: '#FB923C', field: 'crest_factor' as const },
  { key: 'peak', label: 'Peak', color: '#4ADE80', field: 'peak' as const },
];

export default function MotorInspector({
  motor,
  action,
  onActionChange,
  thresholds,
}: MotorInspectorProps) {
  const reduceMotion = useReducedMotion();
  const [highlighted, setHighlighted] = useState<number[]>([]);
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
    rms: true, kurtosis: true, crest: false, peak: false,
  });
  const [range, setRange] = useState<[number, number] | null>(null);
  const [mode, setMode] = useState<'compare' | 'rehearse'>('compare');
  const [rmsRehearse, setRmsRehearse] = useState<{ isRehearsing: boolean; severity: SeverityLevel } | null>(null);
  const [kurtRehearse, setKurtRehearse] = useState<{ isRehearsing: boolean; severity: SeverityLevel } | null>(null);

  if (!motor) {
    return (
      <div className="p-8 text-[#4A4E5C] text-xs font-mono">
        SELECT A MOTOR FROM FLEET CONSOLE TO INSPECT
      </div>
    );
  }

  const overall = statusToSeverity(motor.status);
  const overallColor = SEVERITY_COLORS[overall];
  const totalWindows = motor.windows.length;
  const activeRange: [number, number] = range ?? [0, totalWindows - 1];
  const rmsHistory = toDeviationIndex(motor.windows.map((w) => Number(w.rms) || 0));
  const kurtosisHistory = toDeviationIndex(motor.windows.map((w) => Number(w.kurtosis) || 0));
  const faultFlags = motor.windows.map((w) => w.label === 'fault');
  const topContributor = motor.avgKurt >= motor.avgRms * 3 ? 'kurtosis' : 'rms';
  const rehearsingCritical =
    (rmsRehearse?.isRehearsing && rmsRehearse.severity === 'critical') ||
    (kurtRehearse?.isRehearsing && kurtRehearse.severity === 'critical');

  const series = SERIES_META.map((m) => ({
    key: m.key,
    label: m.label,
    color: m.color,
    visible: visibleSeries[m.key],
    values: toDeviationIndex(motor.windows.map((w) => Number(w[m.field]) || 0)),
  }));

  const toggleHighlight = (i: number) => {
    setHighlighted((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  };

  return (
    <motion.div
      key={motor.file}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
      className="p-5 flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-base font-mono font-semibold text-[#D7D9E0]">{motor.name}</h1>
        <span className="text-[10px] font-mono text-[#4A4E5C]">
          THRESHOLDS {thresholds.watch}/{thresholds.critical}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Risk Level" value={SEVERITY_LABELS[overall]} color={overallColor} big />
        <StatCard label="Total Windows" value={motor.total} />
        <StatCard label="Fault Rate" value={`${motor.faultPct.toFixed(1)}%`} />
        <StatCard label="Highlighted" value={highlighted.length} color="#3B82F6" />
      </div>

      <MultimodalPanel motor={motor} />

      <div className="flex gap-2">
        <Button variant="primary" active={action === 'acknowledged'} onClick={() => onActionChange('acknowledged')}>
          Acknowledge
        </Button>
        <Button variant="primary" active={action === 'scheduled'} onClick={() => onActionChange('scheduled')}>
          Schedule
        </Button>
        <Button variant="danger" active={action === 'escalated'} onClick={() => onActionChange('escalated')}>
          Escalate
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {action !== 'none' && (
          <motion.p
            key={action}
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}
            className="text-[10px] font-mono text-[#4A4E5C] overflow-hidden"
          >
            {ACTION_COPY[action]}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Window data left, comparison graph right */}
      <div className="grid grid-cols-[300px_1fr] gap-4">
        <div className="border border-[#1E212A] bg-[#111318] overflow-y-auto" style={{ maxHeight: 560 }}>
          <div className="px-3 py-2 border-b border-[#1E212A] text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] sticky top-0 bg-[#111318]">
            Window Data · click to compare
          </div>
          {motor.windows.map((w, i) => {
            const active = highlighted.includes(i);
            return (
              <button
                key={i}
                onClick={() => toggleHighlight(i)}
                className="w-full flex items-center justify-between px-3 py-1.5 border-b border-[#15171D] last:border-b-0 text-left hover:bg-[#15171D] transition-colors"
                style={{
                  background: active ? '#3B82F610' : 'transparent',
                  borderLeft: active ? '2px solid #3B82F6' : '2px solid transparent',
                }}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: w.label === 'fault' ? '#22D3EE' : '#2A2E3A' }}
                  />
                  <span className="text-xs font-mono text-[#D7D9E0]">Window {i}</span>
                </span>
                <span className="text-[10px] font-mono text-[#4A4E5C] tabular-nums">
                  rms {Number(w.rms).toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Button variant="secondary" active={mode === 'compare'} onClick={() => setMode('compare')}>
              Compare
            </Button>
            <Button variant="secondary" active={mode === 'rehearse'} onClick={() => setMode('rehearse')}>
              Rehearse
            </Button>
          </div>

          {mode === 'compare' && (
            <>
              <ComparisonChart
                series={series}
                range={activeRange}
                highlightIndices={highlighted}
                thresholds={thresholds}
                onToggleSeries={(key) => setVisibleSeries((v) => ({ ...v, [key]: !v[key] }))}
              />
              <div className="border border-[#1E212A] bg-[#111318] p-4">
                <RangeSlider min={0} max={totalWindows - 1} value={activeRange} onChange={setRange} />
              </div>
            </>
          )}

          {mode === 'rehearse' && (
            <>
              <DraggableSignalTrace
                label="RMS amplitude"
                unit="idx"
                history={rmsHistory}
                faultFlags={faultFlags}
                thresholds={thresholds}
                isTopContributor={topContributor === 'rms'}
                accentColor="#22D3EE"
                onRehearseChange={setRmsRehearse}
              />
              <DraggableSignalTrace
                label="Kurtosis"
                unit="idx"
                history={kurtosisHistory}
                faultFlags={faultFlags}
                thresholds={thresholds}
                isTopContributor={topContributor === 'kurtosis'}
                accentColor="#A78BFA"
                onRehearseChange={setKurtRehearse}
              />
              <AnimatePresence>
                {rehearsingCritical && action === 'none' && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3 border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-3 py-2">
                      <span className="text-[10px] font-mono text-[#22D3EE]">
                        REHEARSAL SHOWS CRITICAL — schedule an inspection before this drift becomes real?
                      </span>
                      <Button variant="danger" size="sm" onClick={() => onActionChange('scheduled')}>
                        Schedule now
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}