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
  safe:   { fg: '#FFFFFF', bg: 'rgba(110, 231, 168, 0.12)', track: 'rgba(110, 231, 168, 0.32)' },
  warn:   { fg: '#4DB8FF', bg: 'rgba(232, 179, 102, 0.12)', track: 'rgba(232, 179, 102, 0.32)' },
  accent: { fg: '#4DB8FF', bg: 'rgba(122, 167, 232, 0.12)', track: 'rgba(122, 167, 232, 0.32)' },
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
  const fillWidth = useTransform(x, (v) => v + 48);
  const labelOpacity = useTransform(x, [0, trackWidth * 0.5], [1, 0]);
  const doneOpacity = useTransform(x, [trackWidth * 0.7, trackWidth * 0.95], [0, 1]);

  const measureTrack = (el: HTMLDivElement | null) => {
    trackRef.current = el;
    if (el) setTrackWidth(el.offsetWidth - 54);
  };

  // Keyboard equivalent. The control exists to force a deliberate act,
  // so a single Enter would defeat it — arrow keys must be pressed
  // repeatedly to walk the handle across, and End is the explicit
  // "I am certain" shortcut.
  const STEP = 0.2; // five presses to cross
  const [kbPct, setKbPct] = useState(0);

  const commit = () => {
    x.set(trackWidth);
    setKbPct(1);
    setConfirmed(true);
    onConfirm();
    setTimeout(() => { x.set(0); setKbPct(0); setConfirmed(false); }, 800);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || confirmed) return;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(1, kbPct + STEP);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, kbPct - STEP);
    else if (e.key === 'End') next = 1;
    else if (e.key === 'Home') next = 0;
    else return;

    e.preventDefault();
    if (next >= 1) { commit(); return; }
    setKbPct(next);
    x.set(trackWidth * next);
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
      className="relative h-11 rounded-[6px] border overflow-hidden select-none touch-none"
      style={{ borderColor: c.track, background: '#08080B' }}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${label} — drag right, or use arrow keys`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((confirmed ? 1 : kbPct) * 100)}
      aria-valuetext={confirmed ? 'Confirmed' : `${Math.round(kbPct * 100)} percent`}
      aria-disabled={disabled}
      onKeyDown={onKeyDown}
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
          <span className="text-[11px] tracking-[0.02em]" style={{ color: c.fg }}>
            {label}
          </span>
          <motion.span
            className="text-[13px]"
            style={{ color: c.fg }}
            animate={reduceMotion ? {} : { x: [0, 4, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          >
            ›››
          </motion.span>
        </div>
      </motion.div>

      {/* Done label — fades in near the end */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: doneOpacity }}
      >
        <span className="text-[11px] tracking-[0.02em]" style={{ color: c.fg }}>
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
        className="absolute left-[3px] top-[3px] bottom-[3px] w-12 rounded-[4px] flex items-center justify-center cursor-grab active:cursor-grabbing text-[#000000]"
      >
        <div className="text-[15px] leading-none" aria-hidden="true">›</div>
      </motion.div>
    </div>
  );
}