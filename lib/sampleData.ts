import { processMotorData } from './processData';
import { Motor } from './types';

interface MotorProfile {
  file: string;
  baseKurt: number;
  baseRms: number;
  faultRate: number;
}

const PROFILES: MotorProfile[] = [
  { file: 'motor_A1.mat', baseKurt: 3.0, baseRms: 0.4, faultRate: 0.02 },
  { file: 'motor_A2.mat', baseKurt: 3.1, baseRms: 0.42, faultRate: 0.01 },
  { file: 'motor_B1.mat', baseKurt: 3.4, baseRms: 0.46, faultRate: 0.08 },
  { file: 'motor_B2.mat', baseKurt: 4.6, baseRms: 0.68, faultRate: 0.18 },
  { file: 'motor_C1.mat', baseKurt: 6.8, baseRms: 0.92, faultRate: 0.35 },
];

const WINDOWS_PER_MOTOR = 60;

/**
 * Synthesizes plausible per-window vibration readings for a small fleet
 * and runs them through the real processMotorData function — the same
 * pipeline a real CSV upload goes through — so "Load sample fleet" is a
 * genuine exercise of the app's logic, not a shortcut around it.
 */
export function generateSampleFleet(): Motor[] {
  const rows: Record<string, unknown>[] = [];

  PROFILES.forEach((p) => {
    for (let w = 0; w < WINDOWS_PER_MOTOR; w++) {
      const isFault = Math.random() < p.faultRate;
      const jitter = (scale: number) => (Math.random() - 0.5) * scale;

      rows.push({
        file: p.file,
        rms: p.baseRms + jitter(p.baseRms * 0.3) + (isFault ? p.baseRms * 0.6 : 0),
        kurtosis: p.baseKurt + jitter(0.6) + (isFault ? p.baseKurt * 0.8 : 0),
        crest_factor: 3 + jitter(0.5),
        peak: p.baseRms * 3 + jitter(0.4),
        label: isFault ? 'fault' : 'normal',
      });
    }
  });

  return processMotorData(rows);
}