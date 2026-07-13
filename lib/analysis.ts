import { Motor } from './types';
import { getMotorTypeLabel, ThresholdNode, getEffectiveThresholdsForMotor } from './thresholdTree';
import { toDeviationIndex } from './normalize';
import { getSeverity, SeverityLevel } from './severity';

export interface SimulationRow {
  motor: Motor;
  live: Record<SeverityLevel, number>;
  draft: Record<SeverityLevel, number>;
}

/** For each motor, classifies every window's RMS deviation index under both
 * the live and draft threshold trees and counts outcomes — a real,
 * data-grounded preview of what deploying the draft would change, not a
 * guess. */
export function simulateThresholdImpact(
  motors: Motor[],
  liveTree: ThresholdNode,
  draftTree: ThresholdNode
): SimulationRow[] {
  return motors.map((motor) => {
    const deviation = toDeviationIndex(motor.windows.map((w) => Number(w.rms) || 0));
    const liveThresholds = getEffectiveThresholdsForMotor(liveTree, motor.file);
    const draftThresholds = getEffectiveThresholdsForMotor(draftTree, motor.file);

    const live: Record<SeverityLevel, number> = { healthy: 0, watch: 0, critical: 0 };
    const draft: Record<SeverityLevel, number> = { healthy: 0, watch: 0, critical: 0 };
    deviation.forEach((v) => {
      live[getSeverity(v, liveThresholds)]++;
      draft[getSeverity(v, draftThresholds)]++;
    });

    return { motor, live, draft };
  });
}

export interface FleetFilter {
  category: string; // 'All' | 'Fan Motor' | 'Pump Motor' | 'Unclassified'
  minFaultRate: number;
}

export function filterMotors(motors: Motor[], filter: FleetFilter): Motor[] {
  return motors.filter((m) => {
    const cat = getMotorTypeLabel(m.file);
    const catOk = filter.category === 'All' || cat === filter.category;
    const rateOk = m.faultPct >= filter.minFaultRate;
    return catOk && rateOk;
  });
}

export function computeCategoryCounts(motors: Motor[]) {
  const categories = ['Fan Motor', 'Pump Motor', 'Unclassified'];
  return categories.map((category) => {
    const inCat = motors.filter((m) => getMotorTypeLabel(m.file) === category);
    return {
      category,
      faults: inCat.reduce((s, m) => s + m.faults, 0),
      total: inCat.reduce((s, m) => s + m.total, 0),
    };
  });
}

export interface HeatmapResult {
  grid: number[][]; // [kurtosisBin][rmsBin] = count
  rmsRange: [number, number];
  kurtRange: [number, number];
  max: number;
}

/** A real 2D density histogram of every raw (RMS, Kurtosis) window pair
 * across the filtered fleet — not synthetic, computed directly from
 * motor.windows. */
export function computeHeatmap(motors: Motor[], bins = 8): HeatmapResult {
  const allRms: number[] = [];
  const allKurt: number[] = [];
  motors.forEach((m) =>
    m.windows.forEach((w) => {
      allRms.push(Number(w.rms) || 0);
      allKurt.push(Number(w.kurtosis) || 0);
    })
  );

  if (allRms.length === 0) {
    return { grid: [], rmsRange: [0, 1], kurtRange: [0, 1], max: 0 };
  }

  const rmsMin = Math.min(...allRms);
  const rmsMax = Math.max(...allRms);
  const kurtMin = Math.min(...allKurt);
  const kurtMax = Math.max(...allKurt);
  const grid: number[][] = Array.from({ length: bins }, () => Array(bins).fill(0));

  motors.forEach((m) =>
    m.windows.forEach((w) => {
      const r = Number(w.rms) || 0;
      const k = Number(w.kurtosis) || 0;
      const rb = Math.min(bins - 1, Math.floor(((r - rmsMin) / (rmsMax - rmsMin || 1)) * bins));
      const kb = Math.min(bins - 1, Math.floor(((k - kurtMin) / (kurtMax - kurtMin || 1)) * bins));
      grid[kb][rb] += 1;
    })
  );

  const max = Math.max(...grid.flat(), 1);
  return { grid, rmsRange: [rmsMin, rmsMax], kurtRange: [kurtMin, kurtMax], max };
}
export interface TreeChange {
  id: string;
  label: string;
  before: {
    watch: number;
    critical: number;
  };
  after: {
    watch: number;
    critical: number;
  };
}

function flattenTree(
  node: ThresholdNode,
  map: Record<string, ThresholdNode> = {}
): Record<string, ThresholdNode> {
  map[node.id] = node;

  node.children.forEach((child) => {
    flattenTree(child, map);
  });

  return map;
}

export function diffTrees(
  liveTree: ThresholdNode,
  draftTree: ThresholdNode
): TreeChange[] {
  const liveMap = flattenTree(liveTree);
  const draftMap = flattenTree(draftTree);

  const changes: TreeChange[] = [];

  Object.keys(draftMap).forEach((id) => {
    const live = liveMap[id];
    const draft = draftMap[id];

    if (!live || !draft) return;

    if (
      live.override?.watch !== draft.override?.watch ||
      live.override?.critical !== draft.override?.critical
    ) {
      changes.push({
        id,
        label: draft.label,
        before: live.override ?? { watch: 0, critical: 0 },
        after: draft.override ?? { watch: 0, critical: 0 },
      });
    }
  });

  return changes;
}
