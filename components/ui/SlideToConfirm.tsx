'use client';
import { useState, useRef } from 'react';
import { motion, PanInfo, useReducedMotion, useMotionValue, useTransform } from 'framer-motion';

interface SlideToConfirmProps {
  onConfirm: () => void;
  label: string;
  intent?: 'safe' | 'warn' | 'accent';
  disabled?: boolean;
}

const INTENT: Record<NonNullable<SlideToConfirmProps['intent']>, { fg: string; bg: string; track: string }> = {
  safe:   { fg: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', track: 'rgba(16, 185, 129, 0.35)' },
  warn:   { fg: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', track: 'rgba(245, 158, 11, 0.35)' },
  accent: { fg: '#60A5FA', bg: 'rgba(96, 165, 250, 0.15)', track: 'rgba(96, 165, 250, 0.35)' },
};

/**
 * Slide-to-unlatch: forces the operator to physically drag a handle across
 * a track before advancing. Used for stepping through the recovery guide
 * to enforce active cognitive confirmation of each real-world action.
 *
 * Handle snaps back with a spring if released below the 90% threshold.
 */
export default function SlideToConfirm({
  onConfirm,
  label,
  intent = 'accent',
  disabled = false,
}: SlideToConfirmProps) {
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [confirmed, setConfirmed] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const c = INTENT[intent];

  // Fill and label opacity derive from x — no state updates during drag
  const fillWidth = useTransform(x, (v) => v + 56);
  const labelOpacity = useTransform(x, [0, trackWidth * 0.5], [1, 0]);
  const doneOpacity = useTransform(x, [trackWidth * 0.7, trackWidth * 0.95], [0, 1]);

  const measureTrack = (el: HTMLDivElement | null) => {
    trackRef.current = el;
    if (el) setTrackWidth(el.offsetWidth - 56);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (disabled) return;
    if (info.point.x >= trackWidth * 0.9 || x.get() >= trackWidth * 0.9) {
      // Confirmed — slam to end, fire callback
      x.set(trackWidth);
      setConfirmed(true);
      onConfirm();
      setTimeout(() => {
        x.set(0);
        setConfirmed(false);
      }, 800);
    } else {
      // Snap back
      x.set(0);
    }
  };

  return (
    <div
      ref={measureTrack}
      className="relative h-14 border-2 overflow-hidden select-none touch-none"
      style={{ borderColor: c.track, background: '#0A0C0F' }}
      role="button"
      aria-label={label}
      aria-disabled={disabled}
    >
      {/* Filled portion — grows behind the handle */}
      <motion.div
        className="absolute inset-y-0 left-0"
        style={{ width: fillWidth, background: c.bg }}
      />

      {/* Center label — fades out as user drags */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: labelOpacity }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-mono uppercase tracking-widest font-semibold" style={{ color: c.fg }}>
            {label}
          </span>
          <motion.span
            className="text-lg"
            style={{ color: c.fg }}
            animate={reduceMotion ? {} : { x: [0, 4, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            ▸▸▸
          </motion.span>
        </div>
      </motion.div>

      {/* Done label — fades in near the end */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: doneOpacity }}
      >
        <span className="text-[13px] font-mono uppercase tracking-widest font-semibold" style={{ color: c.fg }}>
          {confirmed ? 'Confirmed' : 'Release to confirm'}
        </span>
      </motion.div>

      {/* Draggable handle */}
      <motion.div
        drag={disabled || confirmed ? false : 'x'}
        dragConstraints={{ left: 0, right: trackWidth }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x, background: c.fg }}
        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        className="absolute left-1 top-1 bottom-1 w-14 flex items-center justify-center cursor-grab active:cursor-grabbing text-neutral-900"
      >
        <div className="text-2xl leading-none" aria-hidden="true">›</div>
      </motion.div>
    </div>
  );
}