'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { RobotCell } from '../lib/cells';

export type TwinTarget = 'gripper' | 'workpiece' | 'joint2' | 'base' | null;

interface DigitalTwinProps {
  cell: RobotCell;
  showAnomaly?: boolean;
  focusTarget?: TwinTarget;
  auraColor?: string;
}

// Positions of tagged components in twin-space (viewBox 400×260)
const TARGET_ANCHORS: Record<Exclude<TwinTarget, null>, { x: number; y: number; r: number }> = {
  gripper:   { x: 200, y: 156, r: 22 },
  workpiece: { x: 250, y: 165, r: 26 },
  joint2:    { x: 200, y: 134, r: 14 },
  base:      { x: 200, y: 87,  r: 22 },
};

/**
 * Digital Twin — axonometric view of the cell workspace. Accepts an
 * optional `focusTarget` prop; when set, the viewBox smoothly pans and
 * zooms to center that anchor, and a color-matched aura ripples around
 * the target component.
 */
export default function DigitalTwin({
  cell,
  showAnomaly = true,
  focusTarget = null,
  auraColor = '#60A5FA',
}: DigitalTwinProps) {
  const reduceMotion = useReducedMotion();
  const isAssistance = cell.status === 'assistance-required';

  // Compute the viewBox — when a target is focused, zoom to it
  const anchor = focusTarget ? TARGET_ANCHORS[focusTarget] : null;
  const viewBox = anchor
    ? `${anchor.x - 100} ${anchor.y - 65} 200 130`
    : '0 0 400 260';

  return (
    <div className="relative w-full h-full bg-[#0A0C0F] overflow-hidden">
      <motion.svg
        animate={{ viewBox }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <defs>
          <pattern id={`twin-grid-${cell.id}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#1E232B" strokeWidth="0.5" />
          </pattern>
          <linearGradient id={`twin-fade-${cell.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#141820" />
            <stop offset="1" stopColor="#0A0C0F" />
          </linearGradient>
        </defs>

        <rect x="-200" y="-200" width="800" height="660" fill={`url(#twin-fade-${cell.id})`} />
        <rect x="-200" y="-200" width="800" height="660" fill={`url(#twin-grid-${cell.id})`} opacity={0.5} />

        {/* Floor */}
        <polygon points="60,180 340,180 380,240 20,240" fill="#141820" stroke="#1E232B" strokeWidth="1" />

        {/* Conveyor */}
        <polygon points="80,155 320,155 340,175 60,175" fill="#161B22" stroke="#2A303B" strokeWidth="1" />
        {!reduceMotion && (
          <motion.g animate={{ x: [0, 30, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
            {[...Array(10)].map((_, i) => (
              <line key={i} x1={80 + i * 26} y1="158" x2={80 + i * 26 - 4} y2="172" stroke="#2A303B" strokeWidth="0.5" />
            ))}
          </motion.g>
        )}

        {/* Frame */}
        <line x1="90" y1="80" x2="310" y2="80" stroke="#3B4252" strokeWidth="2" />
        <line x1="90" y1="80" x2="90" y2="155" stroke="#3B4252" strokeWidth="2" />
        <line x1="310" y1="80" x2="310" y2="155" stroke="#3B4252" strokeWidth="2" />
        <line x1="70" y1="90" x2="330" y2="90" stroke="#4B5563" strokeWidth="1.5" />
        <line x1="90" y1="80" x2="70" y2="90" stroke="#4B5563" strokeWidth="1" />
        <line x1="310" y1="80" x2="330" y2="90" stroke="#4B5563" strokeWidth="1" />

        {/* Base */}
        <rect x="185" y="80" width="30" height="14" fill="#4B5563" stroke="#6B7280" strokeWidth="0.5" />

        {/* Arm — hesitation loop in assistance state */}
        {isAssistance ? (
          <motion.g
            animate={reduceMotion ? {} : { rotate: [0, 15, 20, 22, 20, 5, 0, 0] }}
            transition={reduceMotion ? { duration: 0 } : { duration: 5, repeat: Infinity, ease: 'easeInOut', times: [0, 0.2, 0.35, 0.4, 0.5, 0.7, 0.85, 1] }}
            style={{ transformOrigin: '200px 94px' }}
          >
            <rect x="196" y="94" width="8" height="40" fill="#9CA3AF" stroke="#D1D5DB" strokeWidth="0.5" rx="1" />
            <circle cx="200" cy="134" r="5" fill="#60A5FA" stroke="#93C5FD" strokeWidth="0.5" />
            <motion.g
              animate={reduceMotion ? {} : { rotate: [0, -10, -15, -18, -15, -5, 0, 0] }}
              transition={reduceMotion ? { duration: 0 } : { duration: 5, repeat: Infinity, ease: 'easeInOut', times: [0, 0.2, 0.35, 0.4, 0.5, 0.7, 0.85, 1] }}
              style={{ transformOrigin: '200px 134px' }}
            >
              <rect x="196" y="134" width="8" height="20" fill="#9CA3AF" stroke="#D1D5DB" strokeWidth="0.5" rx="1" />
              <rect x="190" y="152" width="20" height="6" fill="#F59E0B" stroke="#FCD34D" strokeWidth="0.5" />
            </motion.g>
          </motion.g>
        ) : (
          <motion.g
            animate={reduceMotion ? {} : { rotate: [-5, 5, -5] }}
            transition={reduceMotion ? { duration: 0 } : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '200px 94px' }}
          >
            <rect x="196" y="94" width="8" height="40" fill="#9CA3AF" stroke="#D1D5DB" strokeWidth="0.5" rx="1" />
            <circle cx="200" cy="134" r="5" fill="#60A5FA" stroke="#93C5FD" strokeWidth="0.5" />
            <rect x="196" y="134" width="8" height="20" fill="#9CA3AF" stroke="#D1D5DB" strokeWidth="0.5" rx="1" />
            <rect x="190" y="152" width="20" height="6" fill="#10B981" stroke="#6EE7B7" strokeWidth="0.5" />
          </motion.g>
        )}

        {/* Workpiece — skewed */}
        <g transform="translate(247, 164) rotate(15)">
          <rect x="-17" y="-6" width="34" height="12" fill="#4B5563" stroke="#6B7280" strokeWidth="0.5" />
        </g>
        {/* Upstream workpiece */}
        <rect x="120" y="158" width="30" height="10" fill="#4B5563" stroke="#6B7280" strokeWidth="0.5" />

        {/* Anomaly box */}
        {showAnomaly && isAssistance && (
          <g>
            <motion.rect
              x="222" y="150" width="60" height="30"
              fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeDasharray="4 2"
              animate={reduceMotion ? {} : { opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            {[
              { x: 222, y: 150, dx: 6, dy: 6 },
              { x: 282, y: 150, dx: -6, dy: 6 },
              { x: 222, y: 180, dx: 6, dy: -6 },
              { x: 282, y: 180, dx: -6, dy: -6 },
            ].map(({ x, y, dx, dy }, i) => (
              <g key={i}>
                <line x1={x} y1={y} x2={x + dx} y2={y} stroke="#F59E0B" strokeWidth="2.5" />
                <line x1={x} y1={y} x2={x} y2={y + dy} stroke="#F59E0B" strokeWidth="2.5" />
              </g>
            ))}
          </g>
        )}

        {/* AURA — matches selected data card's accent color */}
        {anchor && (
          <g>
            <motion.circle
              cx={anchor.x} cy={anchor.y} r={anchor.r}
              fill="none"
              stroke={auraColor}
              strokeWidth="2"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={reduceMotion ? { scale: 1, opacity: 1 } : {
                scale: [0.9, 1.15, 1],
                opacity: [0, 0.9, 0.75],
              }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.7, ease: 'easeOut' }}
              style={{ transformOrigin: `${anchor.x}px ${anchor.y}px` }}
            />
            {/* Ripple pulses */}
            {!reduceMotion && [0, 0.8].map((delay, i) => (
              <motion.circle
                key={i}
                cx={anchor.x} cy={anchor.y} r={anchor.r}
                fill="none"
                stroke={auraColor}
                strokeWidth="1.5"
                animate={{
                  scale: [1, 1.8],
                  opacity: [0.6, 0],
                }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  ease: 'easeOut',
                  delay,
                }}
                style={{ transformOrigin: `${anchor.x}px ${anchor.y}px` }}
              />
            ))}
          </g>
        )}
      </motion.svg>

      {/* Chrome label */}
      <div className="absolute top-3 right-3 text-[10px] font-mono uppercase tracking-widest text-neutral-400 border border-neutral-700 bg-black/60 backdrop-blur-sm px-2 py-1">
        Digital Twin
      </div>

      {isAssistance && showAnomaly && !anchor && (
        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-[#F59E0B] bg-black/70 backdrop-blur-sm px-3 py-1.5 border border-[#F59E0B]/50 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F59E0B] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#F59E0B]" />
          </span>
          Anomaly · workpiece 15° skew
        </div>
      )}
    </div>
  );
}