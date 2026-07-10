'use client';
import Card from './ui/Card';
import SeverityBadge from './SeverityBadge';
import { statusToSeverity, SEVERITY_COLORS } from '../lib/severity';
import { toDeviationIndex } from '../lib/normalize';
import { fleetMetrics } from '../lib/processData';
import { Motor, ActionState } from '../lib/types';

interface FleetConsoleProps {
  motors: Motor[];
  selectedMotor: Motor | null;
  onSelectMotor: (motor: Motor) => void;
  actions?: Record<string, ActionState>;
}

const ACTION_LABELS: Record<ActionState, string> = {
  none: 'UNREVIEWED',
  acknowledged: 'ACKNOWLEDGED',
  scheduled: 'SCHEDULED',
  escalated: 'ESCALATED',
};

export default function FleetConsole({ motors, selectedMotor, onSelectMotor, actions = {} }: FleetConsoleProps) {
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
      {/* Dense metric strip */}
      <div className="grid grid-cols-6 gap-px bg-[#1E212A] border border-[#1E212A]">
        <MetricTile label="TOTAL" value={metrics.total} />
        <MetricTile label="CRITICAL" value={metrics.faultN} color={SEVERITY_COLORS.critical} />
        <MetricTile label="WATCH" value={metrics.warnN} color={SEVERITY_COLORS.watch} />
        <MetricTile label="NOMINAL" value={metrics.okN} color={SEVERITY_COLORS.healthy} />
        <MetricTile label="FAULT RATE" value={metrics.faultRate} />
        <MetricTile label="AVG KURTOSIS" value={metrics.avgKurt} />
      </div>

      {/* Dense table */}
      <Card padded={false} className="overflow-hidden">
        <div className="grid grid-cols-[1fr_90px_90px_90px_130px_120px_100px] gap-3 px-3 py-2 border-b border-[#1E212A] text-[10px] font-mono uppercase tracking-wide text-[#4A4E5C]">
          <span>Motor</span>
          <span className="text-right">Fault %</span>
          <span className="text-right">Avg RMS</span>
          <span className="text-right">Avg Kurt</span>
          <span>Trend</span>
          <span>Status</span>
          <span>Review</span>
        </div>
        {motors.map((motor) => (
          <MotorRow
            key={motor.file}
            motor={motor}
            action={actions[motor.file] ?? 'none'}
            selected={selectedMotor?.file === motor.file}
            onClick={() => onSelectMotor(motor)}
          />
        ))}
      </Card>
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

function MotorRow({
  motor,
  action,
  selected,
  onClick,
}: {
  motor: Motor;
  action: ActionState;
  selected: boolean;
  onClick: () => void;
}) {
  const severity = statusToSeverity(motor.status);
  const color = SEVERITY_COLORS[severity];
  const sparkline = toDeviationIndex(motor.windows.map((w) => Number(w.rms) || 0));

  return (
    <button
      onClick={onClick}
      className="w-full grid grid-cols-[1fr_90px_90px_90px_130px_120px_100px] gap-3 items-center px-3 py-2 border-b border-[#15171D] last:border-b-0 text-left transition-colors hover:bg-[#15171D]"
      style={{
        background: selected ? '#15171D' : 'transparent',
        borderLeft: `2px solid ${selected ? color : 'transparent'}`,
      }}
    >
      <span className="font-mono text-xs text-[#D7D9E0]">{motor.name}</span>
      <span className="text-right font-mono text-xs text-[#D7D9E0] tabular-nums">{motor.faultPct.toFixed(1)}%</span>
      <span className="text-right font-mono text-xs text-[#7C8090] tabular-nums">{motor.avgRms.toFixed(2)}</span>
      <span className="text-right font-mono text-xs text-[#7C8090] tabular-nums">{motor.avgKurt.toFixed(2)}</span>
      <Sparkline values={sparkline} color={color} />
      <SeverityBadge level={severity} size="sm" />
      <span className="font-mono text-[10px] text-[#4A4E5C]">{ACTION_LABELS[action]}</span>
    </button>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 110;
  const h = 22;
  if (values.length < 2) return <div style={{ height: h }} />;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / 100) * h}`);
  return (
    <svg width={w} height={h} className="block">
      <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth={1.2} strokeOpacity={0.85} />
    </svg>
  );
}