export type BlockCategory = 'monitoring' | 'actions' | 'control';

export interface BlockParam {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  options?: string[];
  defaultValue: string | number;
}

export interface BlockDefinition {
  id: string;
  name: string;
  category: BlockCategory;
  icon: string;
  version: string;
  description: string;
  params: BlockParam[];
}

export interface ProgramBlock {
  instanceId: string;
  definitionId: string;
  values: Record<string, string | number>;
  configured: boolean;
}

export const BLOCK_LIBRARY: BlockDefinition[] = [
  // Monitoring
  {
    id: 'check-rms',
    name: 'Check RMS Level',
    category: 'monitoring',
    icon: '〜',
    version: 'v1.0',
    description: 'Read current RMS amplitude and compare against threshold.',
    params: [
      { key: 'motor', label: 'Motor File', type: 'select', options: ['motor_A1.mat', 'motor_A2.mat', 'motor_B1.mat', 'motor_B2.mat', 'motor_C1.mat'], defaultValue: 'motor_A1.mat' },
      { key: 'threshold', label: 'Critical Threshold', type: 'number', defaultValue: 70 },
    ],
  },
  {
    id: 'check-kurtosis',
    name: 'Check Kurtosis',
    category: 'monitoring',
    icon: '⊿',
    version: 'v1.0',
    description: 'Read kurtosis value — high kurtosis indicates impact-type faults.',
    params: [
      { key: 'motor', label: 'Motor File', type: 'select', options: ['motor_A1.mat', 'motor_A2.mat', 'motor_B1.mat', 'motor_B2.mat', 'motor_C1.mat'], defaultValue: 'motor_A1.mat' },
      { key: 'threshold', label: 'Alert Threshold', type: 'number', defaultValue: 6 },
    ],
  },
  {
    id: 'compare-baseline',
    name: 'Compare Baseline',
    category: 'monitoring',
    icon: '⇄',
    version: 'v1.1',
    description: 'Compare current reading against a peer robots healthy baseline.',
    params: [
      { key: 'motor', label: 'Motor File', type: 'select', options: ['motor_A1.mat', 'motor_A2.mat', 'motor_B1.mat', 'motor_B2.mat', 'motor_C1.mat'], defaultValue: 'motor_B2.mat' },
      { key: 'peerRobot', label: 'Peer Robot', type: 'select', options: ['Robot B', 'Robot C'], defaultValue: 'Robot B' },
      { key: 'deviationLimit', label: 'Max Deviation %', type: 'number', defaultValue: 15 },
    ],
  },
  {
    id: 'read-thermal',
    name: 'Read Thermal (Derived)',
    category: 'monitoring',
    icon: '◐',
    version: 'v0.9',
    description: 'Derive thermal estimate from vibration deviation — not a real sensor read.',
    params: [
      { key: 'motor', label: 'Motor File', type: 'select', options: ['motor_A1.mat', 'motor_A2.mat', 'motor_B1.mat', 'motor_B2.mat', 'motor_C1.mat'], defaultValue: 'motor_C1.mat' },
    ],
  },
  // Actions
  {
    id: 'set-threshold',
    name: 'Set Threshold',
    category: 'actions',
    icon: '⊞',
    version: 'v1.0',
    description: 'Apply a new watch/critical threshold to a motor or category.',
    params: [
      { key: 'target', label: 'Target', type: 'select', options: ['Global', 'Fan Motors', 'Pump Motors', 'motor_A1', 'motor_B2', 'motor_C1'], defaultValue: 'Global' },
      { key: 'watch', label: 'Watch Level', type: 'number', defaultValue: 40 },
      { key: 'critical', label: 'Critical Level', type: 'number', defaultValue: 70 },
    ],
  },
  {
    id: 'schedule-inspection',
    name: 'Schedule Inspection',
    category: 'actions',
    icon: '⊕',
    version: 'v1.0',
    description: 'Create an inspection task for a specific motor.',
    params: [
      { key: 'motor', label: 'Motor File', type: 'select', options: ['motor_A1.mat', 'motor_A2.mat', 'motor_B1.mat', 'motor_B2.mat', 'motor_C1.mat'], defaultValue: 'motor_C1.mat' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['Normal', 'High', 'Critical'], defaultValue: 'High' },
    ],
  },
  {
    id: 'escalate-alert',
    name: 'Escalate Alert',
    category: 'actions',
    icon: '⚡',
    version: 'v1.0',
    description: 'Notify the on-call maintenance lead immediately.',
    params: [
      { key: 'motor', label: 'Motor File', type: 'select', options: ['motor_A1.mat', 'motor_A2.mat', 'motor_B1.mat', 'motor_B2.mat', 'motor_C1.mat'], defaultValue: 'motor_C1.mat' },
      { key: 'message', label: 'Alert Message', type: 'text', defaultValue: '' },
    ],
  },
  {
    id: 'copy-peer-baseline',
    name: 'Copy Peer Baseline',
    category: 'actions',
    icon: '⇋',
    version: 'v1.0',
    description: 'Derive and apply a threshold from a healthy peers operating range.',
    params: [
      { key: 'sourceRobot', label: 'Source Robot', type: 'select', options: ['Robot B', 'Robot C'], defaultValue: 'Robot B' },
      { key: 'motor', label: 'Motor File', type: 'select', options: ['motor_A1.mat', 'motor_A2.mat', 'motor_B1.mat', 'motor_B2.mat', 'motor_C1.mat'], defaultValue: 'motor_B2.mat' },
    ],
  },
  // Control
  {
    id: 'if-critical',
    name: 'If Critical',
    category: 'control',
    icon: '◇',
    version: 'v1.0',
    description: 'Branch: execute subsequent blocks only if the motor is currently critical.',
    params: [
      { key: 'motor', label: 'Motor File', type: 'select', options: ['motor_A1.mat', 'motor_A2.mat', 'motor_B1.mat', 'motor_B2.mat', 'motor_C1.mat'], defaultValue: 'motor_C1.mat' },
    ],
  },
  {
    id: 'wait-windows',
    name: 'Wait N Windows',
    category: 'control',
    icon: '⏳',
    version: 'v1.0',
    description: 'Pause the routine and wait for N new sensor windows before continuing.',
    params: [
      { key: 'count', label: 'Window Count', type: 'number', defaultValue: 5 },
    ],
  },
  {
    id: 'loop-monitor',
    name: 'Loop Monitor',
    category: 'control',
    icon: '↻',
    version: 'v1.0',
    description: 'Repeat the preceding blocks continuously until manually stopped.',
    params: [],
  },
];

export const CATEGORY_LABELS: Record<BlockCategory, string> = {
  monitoring: 'Monitoring',
  actions: 'Actions',
  control: 'Control & Logic',
};

export const CATEGORY_ICONS: Record<BlockCategory, string> = {
  monitoring: '⊙',
  actions: '⊕',
  control: '⇌',
};