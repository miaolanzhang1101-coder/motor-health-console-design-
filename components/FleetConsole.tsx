'use client';
import { SEVERITY_COLORS } from '../lib/severity';
import { fleetMetrics } from '../lib/processData';
import { ThresholdNode, ThresholdValues } from '../lib/thresholdTree';
import { Motor, ActionState } from '../lib/types';
import AnalysisCanvas from './AnalysisCanvas';

interface FleetConsoleProps {
  motors: Motor[];
  selectedMotor: Motor | null;
  onSelectMotor: (motor: Motor) => void;
  actions?: Record<string, ActionState>;
  onActionChange?: (motorFile: string, action: ActionState) => void;
  thresholdTree?: ThresholdNode;
  onThresholdOverrideChange?: (nodeId: string, override: ThresholdValues | null) => void;
}

export default function FleetConsole({
  motors,
  onSelectMotor,
  actions = {},
  onActionChange = () => {},
  thresholdTree,
  onThresholdOverrideChange,
}: FleetConsoleProps) {
  if (motors.length === 0) {
    return (
      <div className="p-8 text-[#7C8090] text-xs font-mono">
        NO DATA LOADED — load sample fleet or upload CSV from the topbar.
      </div>
    );
  }

  const metrics = fleetMetrics(motors);

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="grid grid-cols-6 gap-px bg-[#1E212A] border border-[#1E212A]">
        <MetricTile label="TOTAL" value={metrics.total} />
        <MetricTile label="CRITICAL" value={metrics.faultN} color={SEVERITY_COLORS.critical} />
        <MetricTile label="WATCH" value={metrics.warnN} color={SEVERITY_COLORS.watch} />
        <MetricTile label="NOMINAL" value={metrics.okN} color={SEVERITY_COLORS.healthy} />
        <MetricTile label="FAULT RATE" value={metrics.faultRate} />
        <MetricTile label="AVG KURTOSIS" value={metrics.avgKurt} />
      </div>

      <AnalysisCanvas
        motors={motors}
        onOpenInspector={onSelectMotor}
        actions={actions}
        onActionChange={onActionChange}
        thresholdTree={thresholdTree}
        onThresholdOverrideChange={onThresholdOverrideChange}
      />
    </div>
  );
}

function MetricTile({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-[#111318] px-3 py-2.5">
      <div className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] mb-1">{label}</div>
      <div className="text-lg font-mono font-semibold tabular-nums" style={{ color: color ?? '#D7D9E0' }}>
        {value}
      </div>
    </div>
  );
}