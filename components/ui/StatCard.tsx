interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  big?: boolean;
}

export default function StatCard({ label, value, color, big = false }: StatCardProps) {
  return (
    <div className="bg-[#111318] border border-[#1E212A] px-4 py-3">
      <div className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] mb-1.5">{label}</div>
      <div
        className={`font-mono font-bold tabular-nums ${big ? 'text-2xl' : 'text-lg'}`}
        style={{ color: color ?? '#D7D9E0' }}
      >
        {value}
      </div>
    </div>
  );
}