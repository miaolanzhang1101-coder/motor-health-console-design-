import { Motor } from './types';

export type CellStatus = 'running' | 'idle' | 'paused' | 'assistance-required' | 'error' | 'offline';
export type CellMode = 'autonomous' | 'manual' | 'stopped' | 'recovering';

export interface RobotCell {
  id: string;
  name: string;
  location: string;
  status: CellStatus;
  mode: CellMode;
  battery: number;
  utilizationPct: number;
  currentTask: string | null;
  motor: Motor; // the joint being monitored — the connection to the original data model
  positionOnMap: { x: number; y: number }; // relative to the facility map, 0-100
}

export type JobType = 'inspect' | 'pick-place' | 'return-home' | 'calibrate';
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  cellId: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  note?: string;
}

export const CELL_STATUS_COLORS: Record<CellStatus, string> = {
  running: '#10B981',              // emerald — safe/running
  idle: '#6B7280',                 // slate — quiet, no motion
  paused: '#60A5FA',               // blue — attention but not intervention
  'assistance-required': '#F59E0B', // amber — human help needed
  error: '#EF4444',                // crimson — reserved for structural failures
  offline: '#2A303B',              // deep slate — no signal
};

export const CELL_STATUS_LABELS: Record<CellStatus, string> = {
  running: 'Optimal',
  idle: 'Idle',
  paused: 'Paused',
  'assistance-required': 'Assistance Required',
  error: 'Error',
  offline: 'Offline',
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  inspect: 'Inspect',
  'pick-place': 'Pick & Place',
  'return-home': 'Return home',
  calibrate: 'Calibrate',
};

export const JOB_TYPE_ICONS: Record<JobType, string> = {
  inspect: '◎',
  'pick-place': '⊕',
  'return-home': '⌂',
  calibrate: '⚙',
};

export const JOB_PRIORITY_COLORS: Record<JobPriority, string> = {
  low: '#475569',
  normal: '#7C8090',
  high: '#818CF8',
  critical: '#22D3EE',
};

// Deterministic derivation of cell state from the underlying motor's stats,
// so a motor in trouble surfaces as a cell in trouble — the two data models
// stay linked rather than diverging.
export function cellFromMotor(motor: Motor, index: number): RobotCell {
  // Cells start in whatever state their vibration stats warrant; the
  // 4-step workflow begins with normal operation. The "assistance"
  // state is reached by clicking Simulate anomaly on any cell, which
  // mirrors the real trigger: a vision-system confidence drop.
  const severity: CellStatus =
    motor.faultPct > 20 ? 'error' :
    motor.faultPct > 5 ? 'paused' : 'running';
  const grid = [
    { x: 20, y: 25 }, { x: 45, y: 20 }, { x: 68, y: 30 },
    { x: 30, y: 55 }, { x: 55, y: 60 }, { x: 78, y: 55 },
    { x: 25, y: 80 }, { x: 60, y: 82 }, { x: 82, y: 78 },
  ];
  const cellNumber = String(index + 1).padStart(2, '0');
  return {
    id: `cell-${cellNumber}`,
    name: `Cell ${cellNumber}`,
    location: index < 3 ? 'Line A' : index < 6 ? 'Line B' : 'Line C',
    status: severity,
    mode: severity === 'error' ? 'stopped' : 'autonomous',
    battery: 55 + ((index * 7) % 45),
    utilizationPct: severity === 'error' ? 0 : Math.round(60 + Math.random() * 35),
    currentTask: severity === 'error' ? null : ['inspect', 'pick-place', 'calibrate'][index % 3],
    motor,
    positionOnMap: grid[index % grid.length],
  };
}