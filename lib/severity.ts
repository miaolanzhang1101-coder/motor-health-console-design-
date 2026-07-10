export type SeverityLevel = 'healthy' | 'watch' | 'critical';

import { MotorStatus } from './types';

export function statusToSeverity(status: MotorStatus): SeverityLevel {
  if (status === 'fault') return 'critical';
  if (status === 'warning') return 'watch';
  return 'healthy';
}

export interface SeverityThresholds {
  watch: number;
  critical: number;
}

export const DEFAULT_THRESHOLDS: SeverityThresholds = { watch: 40, critical: 70 };

export function getSeverity(
  value: number,
  thresholds: SeverityThresholds = DEFAULT_THRESHOLDS
): SeverityLevel {
  if (value >= thresholds.critical) return 'critical';
  if (value >= thresholds.watch) return 'watch';
  return 'healthy';
}

export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  healthy: '#22C55E',
  watch: '#F59E0B',
  critical: '#EF4444',
};

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  critical: 'Critical',
};

/**
 * Rough "how long until this crosses into critical" projection for the
 * rehearsal drag interaction. This is a linear heuristic over the dragged
 * delta, NOT a real forecast from the anomaly model — it exists to make
 * the drag mechanic feel like planning rather than just a toy slider.
 * Replace with a real projection once the model can produce one.
 */
export function rehearseTimeline(
  current: number,
  projected: number,
  thresholds: SeverityThresholds = DEFAULT_THRESHOLDS
): string | null {
  if (projected <= current) return null;
  const delta = projected - current;
  const distanceToCritical = thresholds.critical - current;
  if (distanceToCritical <= 0) return null;
  const assumedDriftWindowDays = 7; // assume the dragged delta represents ~1 week of drift
  const rate = delta / assumedDriftWindowDays;
  if (rate <= 0) return null;
  const daysToCritical = Math.round(distanceToCritical / rate);
  if (daysToCritical > 90) return null;
  return `At this rate, roughly ${daysToCritical} day${daysToCritical === 1 ? '' : 's'} to critical`;
}