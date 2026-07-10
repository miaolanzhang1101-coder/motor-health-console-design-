import Card from './Card';

interface KPICardProps {
  label: string;
  value: string | number;
  color?: string;
  trend?: string;
}

export default function KPICard({ label, value, color, trend }: KPICardProps) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[#9096a3] uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-2xl font-semibold tabular-nums"
          style={{ color: color ?? '#e4e6eb' }}
        >
          {value}
        </span>
        {trend && <span className="text-[11px] text-[#5c6270] font-mono">{trend}</span>}
      </div>
    </Card>
  );
}