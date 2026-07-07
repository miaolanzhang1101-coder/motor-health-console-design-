'use client';
import { useRef, useState, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import SeverityBadge from './SeverityBadge';
import {
  getSeverity,
  rehearseTimeline,
  SEVERITY_COLORS,
  SeverityThresholds,
  DEFAULT_THRESHOLDS,
} from '../lib/severity';

interface DraggableSignalTraceProps {
  label: string;
  unit: string;
  history: number[];
  min?: number;
  max?: number;
  thresholds?: SeverityThresholds;
  isTopContributor?: boolean;
}

const WIDTH = 640;
const HEIGHT = 200;
const PAD_TOP = 24;
const PAD_BOTTOM = 28;
const PAD_LEFT = 8;
const PAD_RIGHT = 36;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const KEY_STEP = 2;

export default function DraggableSignalTrace({
  label,
  unit,
  history,
  min = 0,
  max = 100,
  thresholds = DEFAULT_THRESHOLDS,
  isTopContributor = false,
}: DraggableSignalTraceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const reduceMotion = useReducedMotion();
  const safeHistory = history && history.length > 0 ? history : [0];
  const liveValue = safeHistory[safeHistory.length - 1] ?? 0;
  const [rehearsedValue, setRehearsedValue] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const displayValue = rehearsedValue ?? liveValue;
  const severity = getSeverity(displayValue, thresholds);
  const color = SEVERITY_COLORS[severity];
  const timeline = rehearsedValue !== null ? rehearseTimeline(liveValue, rehearsedValue, thresholds) : null;

  const valueToY = useCallback((v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * PLOT_HEIGHT, [min, max]);
  const yToValue = useCallback((y: number) => {
    const clamped = Math.min(Math.max(y, PAD_TOP), PAD_TOP + PLOT_HEIGHT);
    const ratio = 1 - (clamped - PAD_TOP) / PLOT_HEIGHT;
    return Math.round(min + ratio * (max - min));
  }, [min, max]);

  const points = safeHistory.map((v, i) => {
    const x = PAD_LEFT + (i / (safeHistory.length - 1 || 1)) * PLOT_WIDTH;
    return `${x},${valueToY(v)}`;
  });
  const pathD = `M ${points.join(' L ')}`;
  const handleX = PAD_LEFT + PLOT_WIDTH;
  const liveY = valueToY(liveValue);
  const displayY = valueToY(displayValue);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const localY = (e.clientY - rect.top) * (HEIGHT / rect.height);
    setRehearsedValue(yToValue(localY));
  }, [yToValue]);

  const stopDragging = useCallback(() => {
    setDragging(false);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopDragging);
  }, [handlePointerMove]);

  const startDragging = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    if (rehearsedValue === null) setRehearsedValue(liveValue);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const base = rehearsedValue ?? liveValue;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setRehearsedValue(Math.min(max, base + KEY_STEP));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setRehearsedValue(Math.max(min, base - KEY_STEP));
    } else if (e.key === 'Escape' || e.key === 'Enter') {
      setRehearsedValue(null);
    }
  };

  const reset = () => setRehearsedValue(null);
  const springTransition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 28 };

  return (
    <div
      className="rounded-lg border p-4 pb-3 bg-[#161b23]"
      style={{ borderColor: isTopContributor ? `${color}66` : '#262c38' }}
    >
      <div className="flex justify-between items-baseline mb-1">
        <div className="flex items-baseline gap-2">
          <span className="font-sans text-sm font-semibold text-slate-100">{label}</span>
          {isTopContributor && (
            <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color }}>
              flagged signal
            </span>
          )}
        </div>
        <SeverityBadge level={severity} size="sm" />
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto block touch-none"
      >
        <line x1={PAD_LEFT} x2={PAD_LEFT + PLOT_WIDTH} y1={valueToY(thresholds.watch)} y2={valueToY(thresholds.watch)}
          stroke="#F5A623" strokeOpacity={0.25} strokeDasharray="4 4" />
        <line x1={PAD_LEFT} x2={PAD_LEFT + PLOT_WIDTH} y1={valueToY(thresholds.critical)} y2={valueToY(thresholds.critical)}
          stroke="#FF5D5D" strokeOpacity={0.25} strokeDasharray="4 4" />

        <path d={pathD} fill="none" stroke="#3D4552" strokeWidth={2} />

        {rehearsedValue !== null && (
          <>
            <line x1={PAD_LEFT} x2={PAD_LEFT + PLOT_WIDTH} y1={liveY} y2={liveY}
              stroke="#6b7684" strokeOpacity={0.6} strokeDasharray="3 3" />
            <circle cx={handleX} cy={liveY} r={4} fill="#6b7684" fillOpacity={0.6} />
            <text x={handleX + 8} y={liveY + 3} fontFamily="'JetBrains Mono', monospace" fontSize={10} fill="#6b7684">
              live {liveValue}
            </text>
          </>
        )}

        <motion.line
          x1={handleX - 10} x2={handleX + 10}
          animate={{ y1: displayY, y2: displayY }}
          transition={springTransition}
          stroke={color} strokeWidth={2}
        />
        <motion.circle
          cx={handleX}
          animate={{ cy: displayY, r: dragging ? 9 : 7 }}
          transition={springTransition}
          fill="#161b23" stroke={color} strokeWidth={2}
          onPointerDown={startDragging}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="slider"
          aria-label={`${label} rehearsal value, currently ${displayValue} ${unit}. Drag, or use arrow keys, to rehearse a future reading.`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={displayValue}
          className="cursor-ns-resize focus:outline-none focus-visible:drop-shadow-[0_0_0_3px_rgba(79,209,197,0.5)]"
        />
        <text x={handleX - 16} y={displayY - 12} textAnchor="end"
          fontFamily="'JetBrains Mono', monospace" fontSize={12} fontWeight={600} fill={color}>
          {displayValue} {unit}
        </text>
      </svg>

      <div className="flex justify-between items-center min-h-[20px] mt-0.5">
        <span className="font-mono text-[11px] text-slate-500">
          {timeline ?? 'Drag the marker, or focus it and use arrow keys, to rehearse a future reading'}
        </span>
        {rehearsedValue !== null && (
          <button
            onClick={reset}
            className="font-mono text-[11px] text-slate-500 border border-[#262c38] rounded px-2 py-0.5 hover:text-slate-300 hover:border-slate-600 transition-colors"
          >
            reset to live
          </button>
        )}
      </div>
    </div>
  );
}