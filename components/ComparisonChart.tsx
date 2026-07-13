'use client';

interface Series {
  key: string;
  label: string;
  color: string;
  values: number[]; // normalized 0-100, full length (not pre-sliced to range)
  visible: boolean;
}

interface ComparisonChartProps {
  series: Series[];
  range: [number, number];
  highlightIndices: number[];
  thresholds: { watch: number; critical: number };
  onToggleSeries: (key: string) => void;
}

const WIDTH = 700;
const HEIGHT = 260;
const PAD = { top: 16, bottom: 12, left: 12, right: 12 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

export default function ComparisonChart({ series, range, highlightIndices, thresholds, onToggleSeries }: ComparisonChartProps) {
  const [lo, hi] = range;
  const span = Math.max(hi - lo, 1);

  const xOf = (i: number) => PAD.left + ((i - lo) / span) * PLOT_W;
  const yOf = (v: number) => PAD.top + (1 - v / 100) * PLOT_H;

  return (
    <div className="border border-[#1E212A] bg-[#111318] p-4">
      <div className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] mb-2">
        Comparison View · windows {lo}–{hi}
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yOf(thresholds.watch)} y2={yOf(thresholds.watch)} stroke="#F59E0B" strokeOpacity={0.25} strokeDasharray="3 3" />
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yOf(thresholds.critical)} y2={yOf(thresholds.critical)} stroke="#EF4444" strokeOpacity={0.25} strokeDasharray="3 3" />

        {highlightIndices.map((i) =>
          i >= lo && i <= hi ? (
            <line
              key={i}
              x1={xOf(i)} x2={xOf(i)}
              y1={PAD.top} y2={HEIGHT - PAD.bottom}
              stroke="#3B82F6" strokeOpacity={0.45} strokeWidth={1.5}
            />
          ) : null
        )}

        {series
          .filter((s) => s.visible)
          .map((s) => {
            const pts = s.values
              .map((v, i) => (i >= lo && i <= hi ? `${xOf(i)},${yOf(v)}` : null))
              .filter(Boolean)
              .join(' ');
            return <polyline key={s.key} points={pts} fill="none" stroke={s.color} strokeWidth={1.75} />;
          })}
      </svg>

      <div className="flex gap-4 mt-2 flex-wrap">
        {series.map((s) => (
          <button
            key={s.key}
            onClick={() => onToggleSeries(s.key)}
            className="flex items-center gap-1.5 text-[10px] font-mono transition-colors"
            style={{ color: s.visible ? s.color : '#4A4E5C' }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: s.visible ? s.color : 'transparent', border: `1px solid ${s.color}` }}
            />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}