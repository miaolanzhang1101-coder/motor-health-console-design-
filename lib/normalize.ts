/**
 * Scales a set of raw sensor readings (e.g. kurtosis, RMS) to a 0-100
 * "deviation index" for display and drag purposes only. This is a
 * per-motor min-max scale, not a calibrated engineering unit — it exists
 * so the rehearsal drag interaction has a consistent range to work in,
 * not because kurtosis or RMS are naturally bounded that way. A real
 * severity threshold should ultimately be tuned against raw units per
 * motor class, not this display scale.
 */
export function toDeviationIndex(values: number[]): number[] {
  if (values.length === 0) return [0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => 50);
  return values.map((v) => Math.round(((v - min) / range) * 100));
}


