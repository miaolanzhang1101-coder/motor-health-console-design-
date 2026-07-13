import { SensorWindow, Motor, MotorStatus } from './types';

// Input rows come straight from Papa.parse on an arbitrary CSV, so they're
// only loosely typed here — real-world column sets vary. Cast to
// SensorWindow once grouped, since by then we know the shape well enough
// for the app's purposes.
export function processMotorData(rows: Record<string, unknown>[]): Motor[] {
  const map: Record<string, Record<string, unknown>[]> = {};

  rows.forEach((r) => {
    const key = (r.file as string) || 'unknown';
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });

  return Object.entries(map)
    .map(([file, windows]) => {
      const total = windows.length;
      const faults = windows.filter((w) => w.label === 'fault').length;
      const faultPct = (faults / total) * 100;

      const avg = (key: string) =>
        windows.reduce((s, w) => s + (Number(w[key]) || 0), 0) / total;

      const status: MotorStatus =
        faultPct > 20 ? 'fault' : faultPct > 5 ? 'warning' : 'normal';

      return {
        name: file.replace('.mat', ''),
        file,
        total,
        faults,
        faultPct,
        avgKurt: avg('kurtosis'),
        avgRms: avg('rms'),
        avgCrest: avg('crest_factor'),
        avgPeak: avg('peak'),
        status,
        windows: windows as SensorWindow[],
      };
    })
    .sort((a, b) => b.faultPct - a.faultPct);
}

export function fleetMetrics(motors: Motor[]) {
  const faultN = motors.filter((m) => m.status === 'fault').length;
  const warnN = motors.filter((m) => m.status === 'warning').length;
  const okN = motors.filter((m) => m.status === 'normal').length;
  const totalW = motors.reduce((s, m) => s + m.total, 0);
  const faultW = motors.reduce((s, m) => s + m.faults, 0);
  const avgK = motors.length ? motors.reduce((s, m) => s + m.avgKurt, 0) / motors.length : 0;

  return {
    total: motors.length,
    faultN,
    warnN,
    okN,
    totalW,
    faultRate: totalW ? ((faultW / totalW) * 100).toFixed(1) + '%' : '—',
    avgKurt: avgK.toFixed(2),
  };
}