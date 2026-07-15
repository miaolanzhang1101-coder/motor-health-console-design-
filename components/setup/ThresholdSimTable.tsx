'use client';
import Checkbox from '../ui/Checkbox';
import Input from '../ui/Input';
import { ThresholdNode, ThresholdValues } from '../../lib/thresholdTree';

interface ThresholdSimTableProps {
  node: ThresholdNode;
  baseline: ThresholdValues; // parent's effective value — the "what you'd get with no override"
  effective: ThresholdValues; // this node's actual current value
  affectedCount: number;
  onChange: (override: ThresholdValues | null) => void;
}

export default function ThresholdSimTable({ node, baseline, effective, affectedCount, onChange }: ThresholdSimTableProps) {
  const isRoot = node.id === 'global';
  const hasOverride = node.override !== null;

  return (
    <div className="border border-[#1E212A] bg-[#111318] p-4">
      <div className="mb-3">
        <h2 className="text-sm font-mono font-semibold text-[#D7D9E0]">{node.label}</h2>
        <span className="text-[10px] font-mono text-[#4A4E5C]">
          {hasOverride ? 'SIMULATED OVERRIDE ACTIVE' : 'RUNNING ON INHERITED BASELINE'}
        </span>
      </div>

      {!isRoot && (
        <div className="mb-3">
          <Checkbox
            checked={hasOverride}
            onChange={(checked) => onChange(checked ? { ...effective } : null)}
            label="RUN SIMULATED OVERRIDE"
          />
        </div>
      )}

      <div className="grid grid-cols-[1fr_100px_100px] gap-2 text-[10px] font-mono uppercase tracking-wide text-[#4A4E5C] mb-1.5 px-1">
        <span>Parameter</span>
        <span className="text-right">Baseline</span>
        <span className="text-right">Simulation</span>
      </div>

      <SimRow
        label="Watch"
        baseline={isRoot ? effective.watch : baseline.watch}
        editable={hasOverride}
        value={effective.watch}
        color="#818CF8"
        onChange={(v) => onChange({ ...effective, watch: v })}
      />
      <SimRow
        label="Critical"
        baseline={isRoot ? effective.critical : baseline.critical}
        editable={hasOverride}
        value={effective.critical}
        color="#22D3EE"
        onChange={(v) => onChange({ ...effective, critical: v })}
      />

      {hasOverride && affectedCount > 0 && (
        <div className="text-[10px] font-mono text-[#3B82F6] border border-[#3B82F6]/30 bg-[#3B82F6]/10 px-2.5 py-1.5 mt-3">
          This simulation propagates to {affectedCount} descendant{affectedCount === 1 ? '' : 's'} without their own override.
        </div>
      )}
    </div>
  );
}

function SimRow({
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
    <div className="grid grid-cols-[1fr_100px_100px] gap-2 items-center px-1 py-1.5 border-t border-[#1E212A]">
      <span className="text-xs font-mono text-[#D7D9E0]">{label}</span>
      <span className="text-right text-xs font-mono text-[#4A4E5C] tabular-nums">{baseline}</span>
      <div
        className="text-right"
        style={changed ? { background: `${color}18`, outline: `1px solid ${color}55` } : undefined}
      >
        {editable ? (
          <Input type="number" value={value} onChange={(v) => onChange(Number(v))} color={changed ? color : '#D7D9E0'} />
        ) : (
          <span className="text-xs font-mono text-[#4A4E5C] tabular-nums pr-1">{value}</span>
        )}
      </div>
    </div>
  );
}