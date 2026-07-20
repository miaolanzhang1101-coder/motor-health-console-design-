'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CellStatus, CELL_STATUS_COLORS } from '../../lib/cells';

interface PhysicalSignalProps {
  status: CellStatus;
  size?: number;
}

/**
 * A visual rendering of the physical signal a robot cell would show to
 * humans on the shop floor — a light beacon on top of the cell. The
 * animation timing is meaningful, not decorative: idle = slow breath,
 * running = steady, paused = mid pulse, error = fast attention pulse,
 * offline = no light.
 *
 * This is the design system's answer to "how does hardware communicate
 * with humans" — same visual language as the on-screen pill, so an
 * operator learns one thing and reads it in two places.
 */
export default function PhysicalSignal({ status, size = 32 }: PhysicalSignalProps) {
  const reduceMotion = useReducedMotion();
  const color = CELL_STATUS_COLORS[status];
  const isOffline = status === 'offline';

  const pulseAnimation = (() => {
    if (reduceMotion || isOffline) return {};
    switch (status) {
      case 'running':
        return { opacity: [0.85, 1, 0.85] };
      case 'idle':
        return { opacity: [0.3, 0.7, 0.3] };
      case 'paused':
        return { opacity: [0.5, 0.9, 0.5] };
      case 'assistance-required':
        return { opacity: [0.4, 1, 0.4] };
      case 'error':
        return { opacity: [0.4, 1, 0.4] };
      default:
        return {};
    }
  })();

  const durations: Record<CellStatus, number> = {
    running: 2.4,
    idle: 4,
    paused: 1.8,
    'assistance-required': 0.9,
    error: 0.6,
    offline: 0,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      {/* base plate */}
      <rect x="8" y="28" width="24" height="6" rx="1" fill="#1E212A" />
      {/* beacon stem */}
      <rect x="18" y="18" width="4" height="10" fill="#2A2E3A" />
      {/* light dome — outer glow */}
      {!isOffline && (
        <motion.circle
          cx="20"
          cy="14"
          r="11"
          fill={color}
          fillOpacity={0.15}
          animate={pulseAnimation}
          transition={{
            duration: durations[status],
            repeat: Infinity,
            ease: status === 'error' ? 'easeInOut' : 'easeInOut',
          }}
        />
      )}
      {/* light dome */}
      <motion.circle
        cx="20"
        cy="14"
        r="7"
        fill={isOffline ? '#1E212A' : color}
        fillOpacity={isOffline ? 0.4 : 0.9}
        animate={pulseAnimation}
        transition={{
          duration: durations[status],
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* highlight */}
      {!isOffline && (
        <circle cx="17.5" cy="11.5" r="1.5" fill="#FFFFFF" fillOpacity={0.35} />
      )}
    </svg>
  );
}