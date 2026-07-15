import { Motor, SensorWindow } from './types';

const MAX_WINDOWS = 120; // rolling cap so charts don't grow unbounded during a live session

function generateNextWindow(motor: Motor): SensorWindow {
  const jitter = (scale: number) => (Math.random() - 0.5) * scale;
  const isFault = Math.random() < Math.max(motor.faultPct / 100, 0.01);

  return {
    file: motor.file,
    rms: Math.max(0, motor.avgRms + jitter(motor.avgRms * 0.3) + (isFault ? motor.avgRms * 0.6 : 0)),
    kurtosis: Math.max(0, motor.avgKurt + jitter(0.6) + (isFault ? motor.avgKurt * 0.8 : 0)),
    crest_factor: Math.max(0, motor.avgCrest + jitter(0.5)),
    peak: Math.max(0, motor.avgPeak + jitter(motor.avgPeak * 0.2)),
    label: isFault ? 'fault' : 'normal',
  };
}

/**
 * Appends one new synthetic window to a motor and recomputes its derived
 * stats — the basis for the "Live Stream" mode. This is explicitly a
 * simulated feed seeded from the motor's own current statistics, not a
 * real sensor connection.
 */
export function appendLiveWindow(motor: Motor): Motor {
  const newWindow = generateNextWindow(motor);
  const windows = [...motor.windows, newWindow].slice(-MAX_WINDOWS);
  const total = windows.length;
  const faults = windows.filter((w) => w.label === 'fault').length;
  const faultPct = (faults / total) * 100;
  const avg = (key: 'rms' | 'kurtosis' | 'crest_factor' | 'peak') =>
    windows.reduce((s, w) => s + (Number(w[key]) || 0), 0) / total;

  return {
    ...motor,
    windows,
    total,
    faults,
    faultPct,
    avgRms: avg('rms'),
    avgKurt: avg('kurtosis'),
    avgCrest: avg('crest_factor'),
    avgPeak: avg('peak'),
    status: faultPct > 20 ? 'fault' : faultPct > 5 ? 'warning' : 'normal',
  };
}