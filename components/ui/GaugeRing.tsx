interface GaugeRingProps {
  value: number; // 0-100
  label: string;
  color?: string;
  size?: number;
}

export default function GaugeRing({ value, label, color = '#2563EB', size = 84 }: GaugeRingProps) {
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 100) / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E2E8F0" strokeWidth={7} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={7}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.22}
          fontWeight={700}
          fill="#1E293B"
        >
          {Math.round(value)}%
        </text>
      </svg>
      <span className="text-xs text-[#64748B] text-center max-w-[90px]">{label}</span>
    </div>
  );
}