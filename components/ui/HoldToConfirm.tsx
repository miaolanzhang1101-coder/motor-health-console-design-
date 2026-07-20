'use client';
import { useState, useRef, PointerEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform, animate } from 'framer-motion';

interface HoldToConfirmProps {
  onConfirm: () => void;
  label: string;
  sublabel?: string;
  intent?: 'safe' | 'warn' | 'danger';
  icon?: React.ReactNode;
  duration?: number;
  disabled?: boolean;
}

const INTENT: Record<NonNullable<HoldToConfirmProps['intent']>, { fg: string; bg: string; ring: string; glow: string }> = {
  safe:   { fg: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', ring: '#10B981', glow: 'rgba(16, 185, 129, 0.35)' },
  warn:   { fg: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', ring: '#F59E0B', glow: 'rgba(245, 158, 11, 0.35)' },
  danger: { fg: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)', ring: '#EF4444', glow: 'rgba(239, 68, 68, 0.35)' },
};

/**
 * Press-and-hold to confirm a critical action. Outer ring inflates clockwise
 * over `duration` (default 1.5s). Button icon scales down 5% during the hold
 * to mimic a spring. Release before the ring fills → elastic reset to zero.
 *
 * Used for E-stops, resume-autonomy, and other "prevent-accidental-tap"
 * actions where a glove might otherwise brush the button.
 */
export default function HoldToConfirm({
  onConfirm,
  label,
  sublabel,
  intent = 'warn',
  icon,
  duration = 1500,
  disabled = false,
}: HoldToConfirmProps) {
  const reduceMotion = useReducedMotion();
  const [holding, setHolding] = useState(false);
  const [completed, setCompleted] = useState(false);
  const progress = useMotionValue(0);
  const scale = useMotionValue(1);
  const animRef = useRef<ReturnType<typeof animate> | null>(null);
  const c = INTENT[intent];

  const start = () => {
    if (disabled || completed) return;
    setHolding(true);

    // Fill the ring over `duration` ms
    animRef.current = animate(progress, 1, {
      duration: reduceMotion ? 0.15 : duration / 1000,
      ease: 'linear',
      onComplete: () => {
        setCompleted(true);
        setHolding(false);
        onConfirm();
        // Auto-reset the visual after brief hold at 100%
        setTimeout(() => {
          progress.set(0);
          scale.set(1);
          setCompleted(false);
        }, 600);
      },
    });

    // Scale down 5% during hold (spring feel)
    animate(scale, 0.95, { duration: 0.15, ease: 'easeOut' });
  };

  const cancel = () => {
    if (completed) return;
    setHolding(false);
    animRef.current?.stop();

    // Elastic spring back to 0 — that's the "abort" feedback
    animate(progress, 0, {
      type: 'spring',
      stiffness: 500,
      damping: 22,
    });
    animate(scale, 1, {
      type: 'spring',
      stiffness: 500,
      damping: 15,
    });
  };

  // SVG ring geometry — the outer inflating arc
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = useTransform(progress, (v) => CIRC * (1 - v));

  return (
    <button
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      disabled={disabled}
      className="relative w-32 h-32 flex items-center justify-center select-none disabled:opacity-40 disabled:cursor-not-allowed touch-none"
      aria-label={label}
    >
      {/* Outer glow when holding */}
      <AnimatePresence>
        {holding && !reduceMotion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-full blur-xl"
            style={{ background: c.glow }}
          />
        )}
      </AnimatePresence>

      {/* SVG ring — clockwise inflation */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
        {/* track */}
        <circle cx="50" cy="50" r={R} fill="none" stroke="#1E232B" strokeWidth="3" />
        {/* fill */}
        <motion.circle
          cx="50" cy="50" r={R}
          fill="none"
          stroke={c.ring}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>

      {/* Button body — scales down slightly during hold */}
      <motion.div
        style={{ scale, background: c.bg, borderColor: c.fg, color: c.fg }}
        className="w-24 h-24 rounded-full border-2 flex flex-col items-center justify-center gap-0.5"
      >
        {icon && <div className="text-2xl" aria-hidden="true">{icon}</div>}
        <div className="text-[11px] font-mono uppercase tracking-wider font-semibold">
          {label}
        </div>
        {sublabel && (
          <div className="text-[9px] font-mono text-neutral-500 leading-none">{sublabel}</div>
        )}
      </motion.div>

      {/* Hint below */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono text-neutral-500">
        {holding ? 'Hold…' : completed ? 'Confirmed' : 'Press & hold 1.5s'}
      </div>
    </button>
  );
}