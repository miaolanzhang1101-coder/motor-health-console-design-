import { processMotorData } from './processData';
import { Motor } from './types';
import { toDeviationIndex } from './normalize';
import { ThresholdValues } from './thresholdTree';

export const HARDWARE_MODEL: Record<string, string> = {
  'motor_A1.mat': 'KM-SERVO-100A',
  'motor_A2.mat': 'KM-SERVO-100B',
  'motor_B1.mat': 'KM-SERVO-200A',
  'motor_B2.mat': 'KM-SERVO-200B',
  'motor_C1.mat': 'KM-SERVO-050',
};

export interface RobotFleet {
  robotId: string;
  robotName: string;
  motors: Motor[];
}

interface JointProfile {
  file: string;
  baseKurt: number;
  baseRms: number;
  faultRate: number;
}

function genRobotMotors(profiles: JointProfile[]): Motor[] {
  const rows: Record<string, unknown>[] = [];
  profiles.forEach((p) => {
    for (let w = 0; w < 60; w++) {
      const isFault = Math.random() < p.faultRate;
      const jitter = (s: number) => (Math.random() - 0.5) * s;
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

/** Peer robots on the same production line. Same real pipeline as the main
 * sample fleet, motors use the same file-naming convention so they can be
 * matched to the current robot's motor by `.file` — that match IS the
 * "same component on another machine" detection, not a separate flag. */
export function generatePeerRobots(): RobotFleet[] {
  return [
    {
      robotId: 'robot-b',
      robotName: 'Robot B',
      motors: genRobotMotors([
        { file: 'motor_A1.mat', baseKurt: 3.0, baseRms: 0.4, faultRate: 0.01 },
        { file: 'motor_A2.mat', baseKurt: 3.05, baseRms: 0.41, faultRate: 0.01 },
        { file: 'motor_B1.mat', baseKurt: 3.1, baseRms: 0.44, faultRate: 0.02 },
        { file: 'motor_B2.mat', baseKurt: 3.2, baseRms: 0.46, faultRate: 0.02 }, // runs healthy — a good reference baseline
        { file: 'motor_C1.mat', baseKurt: 3.0, baseRms: 0.4, faultRate: 0.01 },
      ]),
    },
    {
      robotId: 'robot-c',
      robotName: 'Robot C',
      motors: genRobotMotors([
        { file: 'motor_A1.mat', baseKurt: 3.2, baseRms: 0.42, faultRate: 0.03 },
        { file: 'motor_A2.mat', baseKurt: 3.1, baseRms: 0.41, faultRate: 0.02 },
        { file: 'motor_B1.mat', baseKurt: 3.6, baseRms: 0.55, faultRate: 0.1 },
        { file: 'motor_B2.mat', baseKurt: 3.8, baseRms: 0.58, faultRate: 0.12 },
        { file: 'motor_C1.mat', baseKurt: 3.1, baseRms: 0.42, faultRate: 0.02 },
      ]),
    },
  ];
}

/** Derives a suggested watch/critical threshold from a peer motor's own
 * healthy operating range — mean deviation index plus 1.5 / 3 standard
 * deviations — rather than inventing numbers. This is what "copy this
 * unit's healthy baseline" actually computes. */
export function deriveThresholdFromPeer(peer: Motor): ThresholdValues {
  const values = toDeviationIndex(peer.windows.map((w) => Number(w.rms) || 0));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance) || 5;
  return {
    watch: Math.round(Math.min(95, mean + 1.5 * std)),
    critical: Math.round(Math.min(99, mean + 3 * std)),
  };
}