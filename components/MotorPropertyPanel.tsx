'use client';
import Button from './ui/Button';
import Checkbox from './ui/Checkbox';
import Input from './ui/Input';
import SeverityBadge from './SeverityBadge';
import { statusToSeverity } from '../lib/severity';
import { getMotorTypeLabel, ThresholdValues } from '../lib/thresholdTree';
import { Motor, ActionState } from '../lib/types';

interface MotorPropertyPanelProps {
  motor: Motor | null;
  allMotors?: Motor[];
  action: ActionState;
  onActionChange: (action: ActionState) => void;
  onOpenInspector: () => void;
  baseline?: ThresholdValues;
  effective?: ThresholdValues;
  hasOwnOverride?: boolean;
  onThresholdChange?: (override: ThresholdValues | null) => void;
}

export default function MotorPropertyPanel({
  motor,
  allMotors = [],
  action,
  onActionChange,
  onOpenInspector,
  baseline,
  effective,
  hasOwnOverride = false,
  onThresholdChange,
}: MotorPropertyPanelProps) {
  if (!motor) {
    return (
      <div className="border border-[#1E212A] bg-[#111318] p-4 text-xs font-mono text-[#4A4E5C]">
        Click an actuator to see its properties.
      </div>
    );
  }

  const severity = statusToSeverity(motor.status);
  const priority = severity === 'critical' ? 'High Priority' : severity === 'watch' ? 'Medium Priority' : 'Normal';

  const fields: [string, string][] = [
    ['Priority', priority],
    ['Type', getMotorTypeLabel(motor.file)],
    ['Fault Rate', `${motor.faultPct.toFixed(1)}%`],
    ['Avg RMS', motor.avgRms.toFixed(3)],
    ['Avg Kurtosis', motor.avgKurt.toFixed(3)],
    ['Windows', String(motor.total)],
  ];

  return (
    <div className="border border-[#1E212A] bg-[#111318] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-mono font-semibold text-[#D7D9E0]">{motor.name}</span>
        <SeverityBadge level={severity} size="sm" />
      </div>

      <div className="flex flex-col">
        {fields.map(([label, value]) => (
          <div key={label} className="flex justify-between py-1.5 border-b border-[#15171D] last:border-b-0">
            <span className="text-[10px] font-mono text-[#4A4E5C]">{label}</span>
            <span className="text-[11px] font-mono text-[#D7D9E0] tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      {allMotors.length > 0 && (() => {
        const category = getMotorTypeLabel(motor.file);
        const peers = allMotors.filter((m) => m.file !== motor.file && getMotorTypeLabel(m.file) === category);
        if (peers.length === 0) return null;
        return (
          <div className="mt-3 pt-3 border-t border-[#1E212A]">
            <div className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] mb-2">
              Similar Motors ({category})
            </div>
            <div className="flex flex-col gap-1">
              {peers.map((p) => {
                const pSev = statusToSeverity(p.status);
                return (
                  <div key={p.file} className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#7C8090]">{p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#4A4E5C] tabular-nums">{p.faultPct.toFixed(1)}%</span>
                      <SeverityBadge level={pSev} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-[9px] font-mono text-[#4A4E5C] mt-1.5 leading-relaxed">
              Same drift across peers suggests a systemic cause; an isolated reading suggests this unit specifically.
            </div>
          </div>
        );
      })()}

      {baseline && effective && onThresholdChange && (
        <div className="mt-3 pt-3 border-t border-[#1E212A]">
          <div className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] mb-2">
            Alert Thresholds
          </div>
          <Checkbox
            checked={hasOwnOverride}
            onChange={(checked) => onThresholdChange(checked ? { ...effective } : null)}
            label="OVERRIDE FOR THIS ACTUATOR"
          />
          <div className="grid grid-cols-[1fr_50px_50px] gap-1.5 mt-2 text-[9px] font-mono uppercase text-[#4A4E5C]">
            <span />
            <span className="text-right">Base</span>
            <span className="text-right">Sim</span>
          </div>
          <ThresholdRow
            label="Watch"
            baseline={baseline.watch}
            value={effective.watch}
            editable={hasOwnOverride}
            color="#818CF8"
            onChange={(v) => onThresholdChange({ ...effective, watch: v })}
          />
          <ThresholdRow
            label="Critical"
            baseline={baseline.critical}
            value={effective.critical}
            editable={hasOwnOverride}
            color="#22D3EE"
            onChange={(v) => onThresholdChange({ ...effective, critical: v })}
          />
        </div>
      )}

      <div className="flex gap-1.5 mt-3">
        <Button size="sm" variant="primary" active={action === 'acknowledged'} onClick={() => onActionChange('acknowledged')}>
          Ack
        </Button>
        <Button size="sm" variant="primary" active={action === 'scheduled'} onClick={() => onActionChange('scheduled')}>
          Sched
        </Button>
        <Button size="sm" variant="danger" active={action === 'escalated'} onClick={() => onActionChange('escalated')}>
          Esc
        </Button>
      </div>

      <button
        onClick={onOpenInspector}
        className="w-full mt-2 text-[10px] font-mono text-[#3B82F6] border border-[#3B82F6]/30 py-1.5 hover:bg-[#3B82F6]/10 transition-colors"
      >
        Open full inspector →
      </button>
    </div>
  );
}

function ThresholdRow({
  label,
  baseline,
  value,
  editable,
  color,
  onChange,
}: {
  label: string;
  baseline: number;
  value: number;
  editable: boolean;
  color: string;
  onChange: (v: number) => void;
}) {
  const changed = editable && value !== baseline;
  return (
    <div className="grid grid-cols-[1fr_50px_50px] gap-1.5 items-center py-1">
      <span className="text-[10px] font-mono text-[#D7D9E0]">{label}</span>
      <span className="text-right text-[10px] font-mono text-[#4A4E5C] tabular-nums">{baseline}</span>
      {editable ? (
        <div style={changed ? { background: `${color}18`, outline: `1px solid ${color}55` } : undefined}>
          <Input type="number" value={value} onChange={(v) => onChange(Number(v))} color={changed ? color : '#D7D9E0'} />
        </div>
      ) : (
        <span className="text-right text-[10px] font-mono text-[#4A4E5C] tabular-nums">{value}</span>
      )}
    </div>
  );
}