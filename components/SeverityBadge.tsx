'use client';
import { SeverityLevel, SEVERITY_COLORS, SEVERITY_LABELS } from '../lib/severity';

interface SeverityBadgeProps {
  level: SeverityLevel;
  size?: 'sm' | 'md';
}

export default function SeverityBadge({ level, size = 'md' }: SeverityBadgeProps) {
  const color = SEVERITY_COLORS[level];
  const sizeClasses = size === 'sm' ? 'text-[10px]' : 'text-[11px]';

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={`Severity: ${SEVERITY_LABELS[level]}`}
      className={`inline-flex items-center gap-1.5 font-mono font-semibold uppercase tracking-wide ${sizeClasses}`}
      style={{ color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {SEVERITY_LABELS[level]}
    </span>
  );
}