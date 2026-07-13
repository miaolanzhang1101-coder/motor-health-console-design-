export interface SensorWindow {
  file: string;
  rms: number;
  kurtosis: number;
  crest_factor: number;
  peak: number;
  label: 'fault' | 'normal' | string;
  [key: string]: unknown;
}

export type MotorStatus = 'fault' | 'warning' | 'normal';

export interface Motor {
  name: string;
  file: string;
  total: number;
  faults: number;
  faultPct: number;
  avgKurt: number;
  avgRms: number;
  avgCrest: number;
  avgPeak: number;
  status: MotorStatus;
  windows: SensorWindow[];
}

export type ActionState = 'none' | 'acknowledged' | 'scheduled' | 'escalated';

export type ViewKey = 'fleet' | 'inspector' | 'setup' | 'ai';
