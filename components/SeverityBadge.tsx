'use client';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { SeverityLevel, SEVERITY_COLORS, SEVERITY_LABELS } from '../lib/severity';

interface SeverityBadgeProps {
  level: SeverityLevel;
  size?: 'sm' | 'md';
}

const SEVERITY_CLASSES: Record<SeverityLevel, string> = {
  healthy: 'text-[var(--sev)] border-[var(--sev)]/30 bg-[var(--sev)]/10',
  watch: 'text-[var(--sev)] border-[var(--sev)]/30 bg-[var(--sev)]/10',
  critical: 'text-[var(--sev)] border-[var(--sev)]/30 bg-[var(--sev)]/10',
};

export default function SeverityBadge({ level, size = 'md' }: SeverityBadgeProps) {
  const color = SEVERITY_COLORS[level];
  const reduceMotion = useReducedMotion();
  const sizeClasses = size === 'sm' ? 'px-2 py-[3px] text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`Severity: ${SEVERITY_LABELS[level]}`}
      style={{ '--sev': color } as React.CSSProperties}
      className={`inline-flex items-center gap-1.5 rounded font-mono uppercase tracking-wide border ${sizeClasses} ${SEVERITY_CLASSES[level]}`}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={level}
          initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 20 }}
          className="w-1.5 h-1.5 rounded-full bg-[var(--sev)]"
          style={level === 'critical' && !reduceMotion ? { boxShadow: `0 0 6px ${color}` } : undefined}
        />
      </AnimatePresence>
      {SEVERITY_LABELS[level]}
    </span>
  );
}