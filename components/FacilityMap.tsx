'use client';
import { useState, useRef, WheelEvent, MouseEvent, KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RobotCell, CELL_STATUS_COLORS } from '../lib/cells';

interface FacilityMapProps {
  cells: RobotCell[];
  highlightCellId?: string;
  onCellClick?: (cell: RobotCell) => void;
  dimNonCritical?: boolean;
}

/* Lane skeleton: three aisles joined by two cross-links, in map units. */
const AISLES = [
  { id: 'A', y: 16, x1: 12, x2: 88, label: 'LINE A', sub: 'ASSEMBLY' },
  { id: 'B', y: 32, x1: 12, x2: 88, label: 'LINE B', sub: 'MACHINING' },
  { id: 'C', y: 48, x1: 12, x2: 88, label: 'LINE C', sub: 'PACKAGING' },
];
const CROSS = [
  { x: 12, y1: 16, y2: 48 },
  { x: 88, y1: 16, y2: 48 },
];

/* The active mission route, as an ordered waypoint list. */
const ROUTE = [
  { n: 1, x: 12, y: 48, tag: 'DOCK' },
  { n: 2, x: 12, y: 32, tag: 'LM-04' },
  { n: 3, x: 45, y: 32, tag: 'LM-11' },
  { n: 4, x: 45, y: 16, tag: 'AP-02' },
  { n: 5, x: 72, y: 16, tag: 'LM-18' },
  { n: 6, x: 88, y: 16, tag: 'AP-07' },
];

export default function FacilityMap({
  cells, highlightCellId, onCellClick, dimNonCritical = false,
}: FacilityMapProps) {
  const reduceMotion = useReducedMotion();
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    setT((p) => ({ ...p, k: Math.max(0.6, Math.min(3.5, p.k * (1 - e.deltaY * 0.001))) }));
  };
  const onDown = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as SVGElement).closest?.('[data-interactive]')) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
  };
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setT((p) => ({
      ...p,
      x: drag.current!.tx + (e.clientX - drag.current!.x),
      y: drag.current!.ty + (e.clientY - drag.current!.y),
    }));
  };
  const onUp = () => { drag.current = null; };

  const nodes = cells.map((c) => ({
    cell: c,
    cx: 12 + (c.positionOnMap.x / 100) * 76,
    cy: 16 + (c.positionOnMap.y / 100) * 32,
  }));

  const routePath = ROUTE.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  /* Arrow glyphs placed at the midpoint of each lane segment. */
  const laneArrows: { x: number; y: number; rot: number }[] = [];
  AISLES.forEach((a) => {
    for (let x = a.x1 + 10; x < a.x2; x += 19) laneArrows.push({ x, y: a.y, rot: 0 });
  });
  CROSS.forEach((c) => {
    for (let y = c.y1 + 8; y < c.y2; y += 16) laneArrows.push({ x: c.x, y, rot: 90 });
  });

  const activate = (cell: RobotCell) => onCellClick?.(cell);
  const onNodeKey = (e: KeyboardEvent<SVGGElement>, cell: RobotCell) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(cell); }
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-black cursor-grab active:cursor-grabbing"
      onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
    >
      <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" className="w-full h-full block"
        role="img" aria-label={`Facility map, ${cells.length} cells`}>
        <defs>
          <pattern id="fm-fine" width="2" height="2" patternUnits="userSpaceOnUse">
            <path d="M 2 0 L 0 0 0 2" fill="none" stroke="#4DB8FF" strokeWidth="0.04" opacity="0.09" />
          </pattern>
          <pattern id="fm-coarse" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#4DB8FF" strokeWidth="0.07" opacity="0.20" />
          </pattern>
          <radialGradient id="fm-vig" cx="50%" cy="50%" r="72%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.9" />
          </radialGradient>
          <marker id="fm-tip" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="3.2" markerHeight="3.2" orient="auto">
            <path d="M 0 1 L 7 4 L 0 7 z" fill="#A5DEFF" />
          </marker>
        </defs>

        <g transform={`translate(${t.x / 8}, ${t.y / 8}) scale(${t.k})`}>
          <rect x="-60" y="-60" width="220" height="180" fill="url(#fm-fine)" />
          <rect x="-60" y="-60" width="220" height="180" fill="url(#fm-coarse)" />

          {/* hall envelope */}
          <rect x="4" y="4" width="92" height="52" fill="none" stroke="#4DB8FF" strokeWidth="0.14" opacity="0.45" />

          {/* traversable corridor — the drivable envelope, drawn as a wide
              translucent stroke beneath the centrelines */}
          <g stroke="#4DB8FF" strokeOpacity="0.10" strokeWidth="5" strokeLinecap="square" fill="none">
            {AISLES.map((a) => <line key={a.id} x1={a.x1} y1={a.y} x2={a.x2} y2={a.y} />)}
            {CROSS.map((c, i) => <line key={i} x1={c.x} y1={c.y1} x2={c.x} y2={c.y2} />)}
          </g>

          {/* corridor edges */}
          <g stroke="#4DB8FF" strokeOpacity="0.28" strokeWidth="0.06" fill="none">
            {AISLES.map((a) => (
              <g key={a.id}>
                <line x1={a.x1} y1={a.y - 2.5} x2={a.x2} y2={a.y - 2.5} />
                <line x1={a.x1} y1={a.y + 2.5} x2={a.x2} y2={a.y + 2.5} />
              </g>
            ))}
            {CROSS.map((c, i) => (
              <g key={i}>
                <line x1={c.x - 2.5} y1={c.y1} x2={c.x - 2.5} y2={c.y2} />
                <line x1={c.x + 2.5} y1={c.y1} x2={c.x + 2.5} y2={c.y2} />
              </g>
            ))}
          </g>

          {/* lane centrelines */}
          <g stroke="#4DB8FF" strokeOpacity="0.4" strokeWidth="0.09" strokeDasharray="1.2 1.2" fill="none">
            {AISLES.map((a) => <line key={a.id} x1={a.x1} y1={a.y} x2={a.x2} y2={a.y} />)}
            {CROSS.map((c, i) => <line key={i} x1={c.x} y1={c.y1} x2={c.x} y2={c.y2} />)}
          </g>

          {/* travel direction */}
          {laneArrows.map((a, i) => (
            <path key={i} d="M -0.7 -0.55 L 0.7 0 L -0.7 0.55 Z" fill="#4DB8FF" opacity="0.45"
              transform={`translate(${a.x} ${a.y}) rotate(${a.rot})`} />
          ))}

          {/* zone labels */}
          {AISLES.map((a) => (
            <g key={a.id}>
              <text x="5.6" y={a.y - 3.4} fontSize="1.5" fontFamily="var(--font-mono)" fill="#FFFFFF" opacity="0.8">
                {a.label}
              </text>
              <text x="5.6" y={a.y - 1.6} fontSize="1.05" fontFamily="var(--font-mono)" fill="#4DB8FF" opacity="0.65">
                {a.sub}
              </text>
            </g>
          ))}

          {/* active mission route */}
          <path d={routePath} fill="none" stroke="#A5DEFF" strokeWidth="0.34"
            strokeLinejoin="round" strokeLinecap="round" markerEnd="url(#fm-tip)" opacity="0.95" />
          {!reduceMotion && (
            <motion.path d={routePath} fill="none" stroke="#FFFFFF" strokeWidth="0.34"
              strokeLinejoin="round" strokeLinecap="round"
              strokeDasharray="3 30"
              animate={{ strokeDashoffset: [0, -33] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }} />
          )}

          {/* waypoints */}
          {ROUTE.map((p) => (
            <g key={p.n}>
              <circle cx={p.x} cy={p.y} r="1.15" fill="#000" stroke="#A5DEFF" strokeWidth="0.13" />
              <g stroke="#A5DEFF" strokeWidth="0.1" opacity="0.9">
                <line x1={p.x - 2} y1={p.y} x2={p.x - 1.5} y2={p.y} />
                <line x1={p.x + 1.5} y1={p.y} x2={p.x + 2} y2={p.y} />
                <line x1={p.x} y1={p.y - 2} x2={p.x} y2={p.y - 1.5} />
                <line x1={p.x} y1={p.y + 1.5} x2={p.x} y2={p.y + 2} />
              </g>
              <text x={p.x} y={p.y + 0.42} fontSize="1.05" fontFamily="var(--font-mono)"
                fill="#A5DEFF" textAnchor="middle">{p.n}</text>
              <text x={p.x + 2.4} y={p.y + 2.9} fontSize="0.95" fontFamily="var(--font-mono)"
                fill="#8B8B96">{p.tag}</text>
            </g>
          ))}

          {/* cell nodes */}
          {nodes.map(({ cell, cx, cy }) => {
            const c = CELL_STATUS_COLORS[cell.status];
            const fault = cell.status === 'assistance-required' || cell.status === 'error';
            const hi = cell.id === highlightCellId;
            const dim = dimNonCritical && !fault && !hi;
            const s = hi || fault ? 1.5 : 1.15;

            return (
              <g key={cell.id}
                data-interactive="1"
                role="button"
                tabIndex={0}
                aria-label={`${cell.name}, ${cell.location}, status ${cell.status}`}
                onClick={(e) => { e.stopPropagation(); activate(cell); }}
                onKeyDown={(e) => onNodeKey(e, cell)}
                style={{ cursor: 'pointer', opacity: dim ? 0.22 : 1, transition: 'opacity 260ms linear' }}
              >
                {fault && !reduceMotion && (
                  <motion.rect
                    x={cx - 4} y={cy - 4} width="8" height="8" fill="none" stroke={c} strokeWidth="0.12"
                    animate={{ opacity: [0.75, 0, 0.75], scale: [0.7, 1.4, 0.7] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                    style={{ transformOrigin: `${cx}px ${cy}px` }} />
                )}

                {(hi || fault) && (
                  <g stroke={c} strokeWidth="0.09" opacity="0.85">
                    <line x1={cx - 3.4} y1={cy} x2={cx - 2.2} y2={cy} />
                    <line x1={cx + 2.2} y1={cy} x2={cx + 3.4} y2={cy} />
                    <line x1={cx} y1={cy - 3.4} x2={cx} y2={cy - 2.2} />
                    <line x1={cx} y1={cy + 2.2} x2={cx} y2={cy + 3.4} />
                  </g>
                )}

                <rect data-node="1" x={cx - s} y={cy - s} width={s * 2} height={s * 2}
                  fill={fault ? c : '#000'} stroke={c} strokeWidth="0.14" />

                <text x={cx + 2.6} y={cy - 1.4} fontSize="1.35" fontFamily="var(--font-mono)"
                  fill={fault ? c : hi ? '#FFFFFF' : '#A0A0AB'}>
                  {cell.name.replace('Cell ', 'C')}
                </text>
                {/* Status is spelled out, not encoded in colour alone */}
                <text x={cx + 2.6} y={cy + 0.5} fontSize="1.05" fontFamily="var(--font-mono)"
                  fill={fault ? c : '#8B8B96'}>
                  {fault ? 'HALTED' : cell.status.toUpperCase()}
                </text>
              </g>
            );
          })}
        </g>

        <rect x="0" y="0" width="100" height="60" fill="url(#fm-vig)" pointerEvents="none" />
      </svg>

      {/* zoom */}
      <div className="absolute bottom-3 left-3 flex flex-col border border-[#1A1A21] bg-black/85">
        {[
          { l: '+', t: 'Zoom in',    f: () => setT((p) => ({ ...p, k: Math.min(3.5, p.k * 1.3) })) },
          { l: '−', t: 'Zoom out',   f: () => setT((p) => ({ ...p, k: Math.max(0.6, p.k / 1.3) })) },
          { l: '⤢', t: 'Reset view', f: () => setT({ x: 0, y: 0, k: 1 }) },
        ].map((b, i) => (
          <button key={b.l} onClick={b.f} title={b.t} aria-label={b.t}
            className={`w-8 h-8 flex items-center justify-center text-[#8B8B96] hover:text-[#4DB8FF] transition-colors ${i ? 'border-t border-[#1A1A21]' : ''}`}>
            <span aria-hidden="true">{b.l}</span>
          </button>
        ))}
      </div>

      {/* legend */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 px-2.5 py-2 border border-[#1A1A21] bg-black/85">
        <div className="text-[10px] text-[#8B8B96]">Route</div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-px bg-[#A5DEFF]" aria-hidden="true" />
          <span className="text-[10px] text-[#A0A0AB]">Active mission</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-[5px] bg-[#4DB8FF]/20 border-y border-[#4DB8FF]/30" aria-hidden="true" />
          <span className="text-[10px] text-[#A0A0AB]">Traversable</span>
        </div>
      </div>

      {/* scale */}
      <div className="absolute bottom-3 right-3 flex items-center gap-3">
        <div className="flex items-end gap-1">
          <div className="w-8 h-px bg-[#4DB8FF]" aria-hidden="true" />
          <span className="text-[10px] font-mono text-[#8B8B96] leading-none">50m</span>
        </div>
        <span className="text-[10px] font-mono text-[#8B8B96] px-2 py-1 border border-[#1A1A21] bg-black/85">
          {(t.k * 100).toFixed(0)}%
        </span>
      </div>

      <div className="absolute top-3 right-3 w-8 h-8 border border-[#1A1A21] bg-black/85 flex flex-col items-center justify-center leading-none">
        <span className="text-[10px] font-mono text-[#4DB8FF]" aria-hidden="true">↑</span>
        <span className="text-[9px] font-mono text-[#8B8B96]">N</span>
      </div>
    </div>
  );
}