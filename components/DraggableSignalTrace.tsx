'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import SeverityBadge from './SeverityBadge';
import {
  getSeverity,
  rehearseTimeline,
  SEVERITY_COLORS,
  SeverityLevel,
  SeverityThresholds,
  DEFAULT_THRESHOLDS,
} from '../lib/severity';

interface DraggableSignalTraceProps {
  label: string;
  unit: string;
  history: number[];
  faultFlags?: boolean[]; // parallel to history — true where the raw window was labeled a real fault
  min?: number;
  max?: number;
  thresholds?: SeverityThresholds;
  isTopContributor?: boolean;
  accentColor?: string;
  onRehearseChange?: (info: { isRehearsing: boolean; severity: SeverityLevel }) => void;
  zoomRange?: [number, number] | null;
  onZoomChange?: (range: [number, number] | null) => void;
}

const WIDTH = 640;
const HEIGHT = 180;
const PAD_TOP = 20;
const PAD_BOTTOM = 30;
const PAD_LEFT = 8;
const PAD_RIGHT = 36;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const KEY_STEP = 2;
const MIN_BRUSH_PX = 8; // below this, treat drag as a click-to-reset instead of a zoom

export default function DraggableSignalTrace({
  label,
  unit,
  history,
  faultFlags,
  min = 0,
  max = 100,
  thresholds = DEFAULT_THRESHOLDS,
  isTopContributor = false,
  accentColor = '#3D4552',
  onRehearseChange,
  zoomRange = null,
  onZoomChange,
}: DraggableSignalTraceProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const reduceMotion = useReducedMotion();
  const safeHistory = history && history.length > 0 ? history : [0];
  const totalLen = safeHistory.length;

  const [zStart, zEnd] = zoomRange ?? [0, totalLen - 1];
  const visibleHistory = safeHistory.slice(zStart, zEnd + 1);
  const visibleFaults = faultFlags?.slice(zStart, zEnd + 1);
  const includesLiveEdge = zEnd === totalLen - 1;
  const isZoomed = zoomRange !== null;

  const liveValue = safeHistory[totalLen - 1] ?? 0;
  const [rehearsedValue, setRehearsedValue] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [brush, setBrush] = useState<{ startX: number; currentX: number } | null>(null);

  const displayValue = rehearsedValue ?? liveValue;
  const severity = getSeverity(displayValue, thresholds);
  const color = SEVERITY_COLORS[severity];
  const timeline = rehearsedValue !== null ? rehearseTimeline(liveValue, rehearsedValue, thresholds) : null;

  useEffect(() => {
    onRehearseChange?.({ isRehearsing: rehearsedValue !== null, severity });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rehearsedValue, severity]);

  const valueToY = useCallback((v: number) => PAD_TOP + (1 - (v - min) / (max - min)) * PLOT_HEIGHT, [min, max]);
  const yToValue = useCallback((y: number) => {
    const clamped = Math.min(Math.max(y, PAD_TOP), PAD_TOP + PLOT_HEIGHT);
    const ratio = 1 - (clamped - PAD_TOP) / PLOT_HEIGHT;
    return Math.round(min + ratio * (max - min));
  }, [min, max]);

  const indexToX = useCallback(
    (i: number) => PAD_LEFT + (i / (visibleHistory.length - 1 || 1)) * PLOT_WIDTH,
    [visibleHistory.length]
  );
  const xToIndex = useCallback(
    (x: number) => {
      const ratio = Math.min(Math.max((x - PAD_LEFT) / PLOT_WIDTH, 0), 1);
      return Math.round(ratio * (visibleHistory.length - 1)) + zStart;
    },
    [visibleHistory.length, zStart]
  );

  const points = visibleHistory.map((v, i) => `${indexToX(i)},${valueToY(v)}`);
  const pathD = `M ${points.join(' L ')}`;
  const handleX = PAD_LEFT + PLOT_WIDTH;
  const liveY = valueToY(liveValue);
  const displayY = valueToY(displayValue);

  // --- vertical drag on the handle: rehearse a future value (unchanged mechanic) ---
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
    e.stopPropagation(); // don't also trigger the brush-to-zoom handler below
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

  // --- horizontal drag on the chart background: brush-select to zoom into a range ---
  const localX = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    return (clientX - rect.left) * (WIDTH / rect.width);
  };

  const handleBrushMove = useCallback((e: PointerEvent) => {
    setBrush((prev) => (prev ? { ...prev, currentX: localX(e.clientX) } : prev));
  }, []);

  const stopBrush = useCallback(() => {
    setBrush((prev) => {
      if (prev) {
        const widthPx = Math.abs(prev.currentX - prev.startX);
        if (widthPx < MIN_BRUSH_PX) {
          onZoomChange?.(null); // treat as a plain click — reset zoom
        } else {
          const i1 = xToIndex(Math.min(prev.startX, prev.currentX));
          const i2 = xToIndex(Math.max(prev.startX, prev.currentX));
          if (i2 - i1 >= 2) onZoomChange?.([i1, i2]);
        }
      }
      return null;
    });
    window.removeEventListener('pointermove', handleBrushMove);
    window.removeEventListener('pointerup', stopBrush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleBrushMove, xToIndex, onZoomChange]);

  const startBrush = (e: React.PointerEvent) => {
    if (!onZoomChange) return;
    e.preventDefault();
    const x = localX(e.clientX);
    setBrush({ startX: x, currentX: x });
    window.addEventListener('pointermove', handleBrushMove);
    window.addEventListener('pointerup', stopBrush);
  };

  const springTransition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 28 };
  const showRehearsal = includesLiveEdge;

  return (
    <div
      className="border bg-[#111318] p-3 pb-2"
      style={{ borderColor: isTopContributor ? color : '#1E212A' }}
    >
      <div className="flex justify-between items-baseline mb-1">
        <div className="flex items-baseline gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
          <span className="text-xs font-mono font-semibold text-[#D7D9E0] uppercase tracking-wide">{label}</span>
          {isTopContributor && (
            <span className="text-[9px] font-mono font-semibold uppercase tracking-wide" style={{ color }}>
              flagged
            </span>
          )}
          {isZoomed && (
            <button
              onClick={() => onZoomChange?.(null)}
              className="text-[9px] font-mono text-[#3B82F6] border border-[#3B82F6]/30 px-1.5 py-0.5 hover:bg-[#3B82F6]/10"
            >
              reset zoom
            </button>
          )}
        </div>
        {showRehearsal ? (
          <SeverityBadge level={severity} size="sm" />
        ) : (
          <span className="text-[9px] font-mono text-[#4A4E5C]">reviewing history · rehearsal disabled</span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto block touch-none"
        onPointerDown={startBrush}
      >
        {!isZoomed && (
          <>
            <line x1={PAD_LEFT} x2={PAD_LEFT + PLOT_WIDTH} y1={valueToY(thresholds.watch)} y2={valueToY(thresholds.watch)}
              stroke="#F59E0B" strokeOpacity={0.25} strokeDasharray="3 3" />
            <line x1={PAD_LEFT} x2={PAD_LEFT + PLOT_WIDTH} y1={valueToY(thresholds.critical)} y2={valueToY(thresholds.critical)}
              stroke="#EF4444" strokeOpacity={0.25} strokeDasharray="3 3" />
          </>
        )}

        <defs>
          <linearGradient id={`grad-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
          </linearGradient>
        </defs>

        <polygon
          points={`${points.join(' ')} ${indexToX(visibleHistory.length - 1)},${HEIGHT - PAD_BOTTOM} ${indexToX(0)},${HEIGHT - PAD_BOTTOM}`}
          fill={`url(#grad-${label.replace(/\s/g, '')})`}
        />
        <path d={pathD} fill="none" stroke={accentColor} strokeWidth={1.75} />

        {/* ground-truth fault markers — real labels from the raw windows, not the derived index */}
        {visibleFaults?.map((isFault, i) =>
          isFault ? (
            <line
              key={i}
              x1={indexToX(i)} x2={indexToX(i)}
              y1={HEIGHT - PAD_BOTTOM + 4} y2={HEIGHT - PAD_BOTTOM + 10}
              stroke="#EF4444" strokeWidth={1.5}
            />
          ) : null
        )}

        {showRehearsal && rehearsedValue !== null && (
          <>
            <line x1={PAD_LEFT} x2={PAD_LEFT + PLOT_WIDTH} y1={liveY} y2={liveY}
              stroke="#4A4E5C" strokeOpacity={0.8} strokeDasharray="2 2" />
            <circle cx={handleX} cy={liveY} r={3} fill="#4A4E5C" />
            <text x={handleX + 8} y={liveY + 3} fontSize={9} fontFamily="monospace" fill="#7C8090">
              live {liveValue}
            </text>
          </>
        )}

        {showRehearsal && (
          <>
            <motion.line
              x1={handleX - 10} x2={handleX + 10}
              animate={{ y1: displayY, y2: displayY }}
              transition={springTransition}
              stroke={color} strokeWidth={1.5}
            />
            <motion.circle
              cx={handleX}
              animate={{ cy: displayY, r: dragging ? 8 : 6 }}
              transition={springTransition}
              fill="#0A0B0D" stroke={color} strokeWidth={1.5}
              onPointerDown={startDragging}
              onKeyDown={handleKeyDown}
              tabIndex={0}
              role="slider"
              aria-label={`${label} rehearsal value, currently ${displayValue} ${unit}. Drag, or use arrow keys, to rehearse a future reading.`}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={displayValue}
              className="cursor-ns-resize focus:outline-none"
            />
            <text x={handleX - 16} y={displayY - 10} textAnchor="end" fontSize={11} fontFamily="monospace" fontWeight={600} fill={color}>
              {displayValue} {unit}
            </text>
          </>
        )}

        {/* brush-to-zoom selection overlay */}
        {brush && (
          <rect
            x={Math.min(brush.startX, brush.currentX)}
            y={PAD_TOP}
            width={Math.abs(brush.currentX - brush.startX)}
            height={PLOT_HEIGHT}
            fill="#3B82F6"
            fillOpacity={0.15}
            stroke="#3B82F6"
            strokeOpacity={0.5}
          />
        )}
      </svg>

      <div className="flex justify-between items-center min-h-[18px] mt-0.5">
        <span className="text-[10px] font-mono text-[#4A4E5C]">
          {showRehearsal
            ? (timeline ?? 'drag the marker to rehearse · drag the chart to zoom a range')
            : `windows ${zStart}–${zEnd} of ${totalLen - 1}`}
        </span>
        {rehearsedValue !== null && showRehearsal && (
          <button
            onClick={reset}
            className="text-[10px] font-mono text-[#7C8090] border border-[#1E212A] px-1.5 py-0.5 hover:text-[#D7D9E0] hover:border-[#2A2E3A] transition-colors"
          >
            reset value
          </button>
        )}
      </div>
    </div>
  );
}