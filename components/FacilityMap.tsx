'use client';
import { useState, useRef, WheelEvent, MouseEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RobotCell, CELL_STATUS_COLORS } from '../lib/cells';

interface FacilityMapProps {
  cells: RobotCell[];
  highlightCellId?: string;
  onCellClick?: (cell: RobotCell) => void;
  dimNonCritical?: boolean;
}

/**
 * A pseudo-geographic facility floor plan — real-map aesthetic with roads,
 * buildings, and cells as pinpoints. Not a real GIS map (no API key needed)
 * but visually reads like one, with a warmer parchment palette instead of
 * pure black.
 */
export default function FacilityMap({ cells, highlightCellId, onCellClick, dimNonCritical = false }: FacilityMapProps) {
  const reduceMotion = useReducedMotion();
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newK = Math.max(0.6, Math.min(3, transform.k * (1 + delta)));
    setTransform((t) => ({ ...t, k: newK }));
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as SVGElement;
    if (target.tagName === 'circle' || target.tagName === 'text') return;
    dragStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!dragStart.current) return;
    setTransform((t) => ({
      ...t,
      x: dragStart.current!.tx + (e.clientX - dragStart.current!.x),
      y: dragStart.current!.ty + (e.clientY - dragStart.current!.y),
    }));
  };

  const handleMouseUp = () => { dragStart.current = null; };

  const reset = () => setTransform({ x: 0, y: 0, k: 1 });
  const zoomIn = () => setTransform((t) => ({ ...t, k: Math.min(3, t.k * 1.3) }));
  const zoomOut = () => setTransform((t) => ({ ...t, k: Math.max(0.6, t.k / 1.3) }));

  // Precompute pinpoint positions
  const pinpoints = cells.map((cell) => ({
    cell,
    cx: 8 + (cell.positionOnMap.x / 100) * 84,
    cy: 8 + (cell.positionOnMap.y / 100) * 44,
  }));

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ background: '#08090C' }}
    >
      <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" className="w-full h-full block">
        <defs>
          {/* fine street grid — small subtle pattern */}
          <pattern id="fm-grid" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M 4 0 L 0 0 0 4" fill="none" stroke="#1A1D24" strokeWidth="0.08" />
          </pattern>
          {/* larger block grid */}
          <pattern id="fm-blocks" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <path d="M 14 0 L 0 0 0 14" fill="none" stroke="#1F232B" strokeWidth="0.15" />
          </pattern>
          {/* dashed connector marker */}
          <marker id="fm-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
            <path d="M 0 0 L 6 3 L 0 6 z" fill="#374151" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x / 8}, ${transform.y / 8}) scale(${transform.k})`}>
          {/* base landmass */}
          <rect x="0" y="0" width="100" height="60" fill="url(#fm-grid)" />
          <rect x="0" y="0" width="100" height="60" fill="url(#fm-blocks)" />

          {/* main "avenues" — thicker roads that split the facility into districts */}
          <rect x="0" y="19" width="100" height="1.6" fill="#1A1D24" />
          <rect x="0" y="35" width="100" height="1.6" fill="#1A1D24" />
          <rect x="0" y="51" width="100" height="1.4" fill="#1A1D24" />
          <rect x="24" y="0" width="1.4" height="60" fill="#1A1D24" />
          <rect x="52" y="0" width="1.4" height="60" fill="#1A1D24" />
          <rect x="78" y="0" width="1.4" height="60" fill="#1A1D24" />

          {/* road centerlines — dashed */}
          <line x1="0" y1="19.8" x2="100" y2="19.8" stroke="#2A303B" strokeWidth="0.1" strokeDasharray="0.8 0.8" />
          <line x1="0" y1="35.8" x2="100" y2="35.8" stroke="#2A303B" strokeWidth="0.1" strokeDasharray="0.8 0.8" />

          {/* "buildings" — building block silhouettes to give geographic depth */}
          <rect x="3" y="4" width="18" height="12" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />
          <rect x="29" y="4" width="20" height="12" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />
          <rect x="57" y="4" width="18" height="12" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />
          <rect x="83" y="4" width="14" height="12" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />
          <rect x="3" y="23" width="18" height="10" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />
          <rect x="29" y="23" width="20" height="10" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />
          <rect x="57" y="23" width="18" height="10" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />
          <rect x="83" y="23" width="14" height="10" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />
          <rect x="3" y="39" width="18" height="10" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />
          <rect x="29" y="39" width="20" height="10" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />
          <rect x="57" y="39" width="18" height="10" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />
          <rect x="83" y="39" width="14" height="10" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />
          <rect x="3" y="53" width="94" height="5" fill="#0E1116" stroke="#1A1D24" strokeWidth="0.15" rx="0.5" />

          {/* district labels */}
          <text x="6" y="10" fontSize="1.6" fontFamily="monospace" fill="#374151" fontWeight="600">LINE A</text>
          <text x="6" y="12.2" fontSize="1" fontFamily="monospace" fill="#2A303B">Assembly</text>
          <text x="32" y="10" fontSize="1.6" fontFamily="monospace" fill="#374151" fontWeight="600">LINE B</text>
          <text x="32" y="12.2" fontSize="1" fontFamily="monospace" fill="#2A303B">Machining</text>
          <text x="60" y="10" fontSize="1.6" fontFamily="monospace" fill="#374151" fontWeight="600">LINE C</text>
          <text x="60" y="12.2" fontSize="1" fontFamily="monospace" fill="#2A303B">Packaging</text>
          <text x="85" y="10" fontSize="1.4" fontFamily="monospace" fill="#374151" fontWeight="600">DOCK</text>

          <text x="6" y="27" fontSize="1.3" fontFamily="monospace" fill="#2A303B">Storage</text>
          <text x="32" y="27" fontSize="1.3" fontFamily="monospace" fill="#2A303B">QA</text>
          <text x="60" y="27" fontSize="1.3" fontFamily="monospace" fill="#2A303B">Buffer</text>
          <text x="85" y="27" fontSize="1.3" fontFamily="monospace" fill="#2A303B">Charge</text>

          {/* Connection lines between cells — showing job routing paths */}
          {pinpoints.length > 1 && pinpoints.slice(0, -1).map((p, i) => {
            const next = pinpoints[i + 1];
            if (!next) return null;
            return (
              <line
                key={`conn-${i}`}
                x1={p.cx} y1={p.cy}
                x2={next.cx} y2={next.cy}
                stroke="#2A303B"
                strokeWidth="0.15"
                strokeDasharray="0.5 0.5"
                opacity={0.6}
              />
            );
          })}

          {/* Cell pinpoints — map-marker style */}
          {pinpoints.map(({ cell, cx, cy }) => {
            const isHighlight = cell.id === highlightCellId;
            const color = CELL_STATUS_COLORS[cell.status];
            const isAssistance = cell.status === 'assistance-required';
            const isRunning = cell.status === 'running';
            const shouldDim = dimNonCritical && !isAssistance && !isHighlight;
            const cellOpacity = shouldDim ? 0.3 : 1;

            return (
              <g
                key={cell.id}
                onClick={(e) => { e.stopPropagation(); onCellClick?.(cell); }}
                style={{ cursor: onCellClick ? 'pointer' : 'default', opacity: cellOpacity, transition: 'opacity 0.3s ease' }}
              >
                {/* outer pulse */}
                {(isAssistance || isRunning) && !reduceMotion && (
                  <motion.circle
                    cx={cx}
                    cy={cy - 2}
                    r={2.5}
                    fill={color}
                    fillOpacity={0.2}
                    animate={{
                      r: isAssistance ? [2, 3.6, 2] : [2.4, 2.8, 2.4],
                      opacity: isAssistance ? [0.15, 0.4, 0.15] : [0.15, 0.28, 0.15],
                    }}
                    transition={{
                      duration: isAssistance ? 0.9 : 2.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )}

                {/* map pin — teardrop shape */}
                <path
                  d={`M ${cx} ${cy} L ${cx - 1.4} ${cy - 2.6} A 1.4 1.4 0 1 1 ${cx + 1.4} ${cy - 2.6} Z`}
                  fill={color}
                  stroke={isHighlight ? '#FFFFFF' : '#08090C'}
                  strokeWidth={isHighlight ? 0.25 : 0.18}
                />
                <circle cx={cx} cy={cy - 2.6} r={0.6} fill="#08090C" />

                {/* label */}
                <rect
                  x={cx + 1.6}
                  y={cy - 3.6}
                  width={cell.name.length * 0.9 + 1.5}
                  height={2}
                  fill="#08090C"
                  fillOpacity={0.85}
                  stroke={isAssistance ? color : '#1E232B'}
                  strokeWidth={isAssistance ? 0.15 : 0.1}
                  rx="0.2"
                />
                <text
                  x={cx + 2.2}
                  y={cy - 2.1}
                  fontSize="1.3"
                  fontFamily="monospace"
                  fill={isAssistance ? color : isHighlight ? '#FFFFFF' : '#E5E7EB'}
                  fontWeight={isAssistance ? '700' : '500'}
                >
                  {cell.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-0.5 border border-[#1E232B] bg-[#0A0C0F]/95 backdrop-blur-sm">
        <button
          onClick={zoomIn}
          className="w-8 h-8 flex items-center justify-center text-[#9CA3AF] hover:text-[#E5E7EB] transition-colors"
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-8 h-8 flex items-center justify-center text-[#9CA3AF] hover:text-[#E5E7EB] transition-colors border-t border-[#1E232B]"
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={reset}
          className="w-8 h-8 flex items-center justify-center text-[#9CA3AF] hover:text-[#E5E7EB] transition-colors border-t border-[#1E232B] text-[10px] font-mono"
          title="Reset view"
          aria-label="Reset view"
        >
          ⤢
        </button>
      </div>

      {/* Scale bar + zoom indicator */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <div className="flex items-end gap-0.5 h-3">
          <div className="w-8 h-1 bg-[#6B7280]" />
          <div className="text-[9px] font-mono text-[#9CA3AF] leading-none">50m</div>
        </div>
        <div className="text-[10px] font-mono text-[#9CA3AF] bg-[#0A0C0F]/90 backdrop-blur-sm px-2 py-1 border border-[#1E232B] tabular-nums">
          {(transform.k * 100).toFixed(0)}%
        </div>
      </div>

      {/* North indicator */}
      <div className="absolute top-3 right-3 w-8 h-8 border border-[#1E232B] bg-[#0A0C0F]/90 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center leading-none">
          <div className="text-[10px] font-mono text-[#E5E7EB]">↑</div>
          <div className="text-[8px] font-mono text-[#9CA3AF]">N</div>
        </div>
      </div>
    </div>
  );
}