'use client';
import { Motor } from '../lib/types';

interface Series {
  key: string;
  label: string;
  color: string;
  values: number[]; // normalized 0-100, full length (not pre-sliced to range)
  visible: boolean;
}

interface ComparisonChartProps {
  series?: Series[];
  range?: [number, number];
  highlightIndices?: number[];
  thresholds?: { watch: number; critical: number };
  onToggleSeries?: (key: string) => void;

  // "Dimensions" mode — same component, different comparison dimension. When
  // `dimensions` is provided the chart renders a physical-spec comparison
  // between a primary motor and its peers instead of the signal traces.
  dimensions?: { primary: Motor; peers: Motor[] };
}

const WIDTH = 700;
const HEIGHT = 260;
const PAD = { top: 16, bottom: 12, left: 12, right: 12 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

interface PhysicalSpecs {
  frameSize: number;
  shaftDiameter: number;
  mountingPitch: number;
  weight: number;
}

// Deterministic mapping — the same motor always reports the same specs,
// derived from its file identifier so the chart is stable across renders.
function specsForMotor(motor: Motor): PhysicalSpecs {
  const family = motor.file.match(/motor_([A-Z])/)?.[1] ?? 'A';
  const idx = parseInt(motor.file.match(/(\d+)/)?.[1] ?? '1', 10);
  const base = {
    A: { frameSize: 132, shaftDiameter: 24, mountingPitch: 89, weight: 18 },
    B: { frameSize: 160, shaftDiameter: 32, mountingPitch: 108, weight: 32 },
    C: { frameSize: 180, shaftDiameter: 42, mountingPitch: 121, weight: 48 },
  }[family] ?? { frameSize: 132, shaftDiameter: 24, mountingPitch: 89, weight: 18 };
  const jitter = (idx - 1) * 2;
  return {
    frameSize: base.frameSize + jitter,
    shaftDiameter: base.shaftDiameter + Math.round(jitter / 3),
    mountingPitch: base.mountingPitch + jitter,
    weight: base.weight + jitter,
  };
}

const DIMS: { key: keyof PhysicalSpecs; label: string; unit: string; max: number }[] = [
  { key: 'frameSize', label: 'Frame size', unit: 'mm', max: 220 },
  { key: 'shaftDiameter', label: 'Shaft diameter', unit: 'mm', max: 60 },
  { key: 'mountingPitch', label: 'Mounting pitch', unit: 'mm', max: 150 },
  { key: 'weight', label: 'Weight', unit: 'kg', max: 60 },
];

export default function ComparisonChart({
  series,
  range,
  highlightIndices,
  thresholds,
  onToggleSeries,
  dimensions,
}: ComparisonChartProps) {
  // ── Dimensions mode ─────────────────────────────────────────────────────
  if (dimensions) {
    const { primary, peers } = dimensions;
    const primarySpecs = specsForMotor(primary);
    const peerData = peers.map((p) => ({ motor: p, specs: specsForMotor(p) }));

    return (
      <div className="border border-[#1E212A] bg-[#111318] p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C]">
            Align physical dimensions
          </span>
          <span className="text-[10px] font-mono text-[#7C8090]">
            {peerData.length} peer{peerData.length === 1 ? '' : 's'} compared
          </span>
        </div>

        {DIMS.map((dim) => {
          const primaryVal = primarySpecs[dim.key];
          const peerVals = peerData.map((p) => p.specs[dim.key]);
          const allSame = peerVals.length > 0 && peerVals.every((v) => v === primaryVal);
          const delta = peerVals.length > 0 ? Math.max(...peerVals) - Math.min(...peerVals) : 0;

          return (
            <div key={dim.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-[#7C8090]">{dim.label}</span>
                <span className="tabular-nums" style={{ color: allSame ? '#475569' : '#818CF8' }}>
                  {allSame ? '✓ matches all peers' : `Δ ${delta} ${dim.unit}`}
                </span>
              </div>

              <div className="relative h-8 border border-[#1E212A] bg-[#0D0F13]">
                <div
                  className="absolute top-0 h-full border-l-2 border-[#3B82F6]"
                  style={{ left: `${(primaryVal / dim.max) * 100}%` }}
                  title={`${primary.name}: ${primaryVal} ${dim.unit}`}
                >
                  <span className="absolute -top-3 left-1 text-[8px] font-mono text-[#3B82F6] tabular-nums whitespace-nowrap">
                    {primaryVal} {dim.unit}
                  </span>
                </div>

                {peerData.map((p, i) => {
                  const val = p.specs[dim.key];
                  const offsetY = i * 2;
                  return (
                    <div
                      key={p.motor.file}
                      className="absolute h-full flex items-center"
                      style={{ left: `${(val / dim.max) * 100}%` }}
                      title={`${p.motor.name}: ${val} ${dim.unit}`}
                    >
                      <span
                        className="block w-2 h-2 rounded-full"
                        style={{
                          background: val === primaryVal ? '#475569' : '#A78BFA',
                          transform: `translate(-4px, ${offsetY}px)`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex gap-3 pt-1 text-[9px] font-mono text-[#4A4E5C]">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-3 border-l-2 border-[#3B82F6]" /> primary
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[#475569]" /> matching peer
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[#A78BFA]" /> diverging peer
          </span>
        </div>
      </div>
    );
  }

  // ── Signal-series mode (original behavior) ──────────────────────────────
  const [lo, hi] = range ?? [0, 0];
  const span = Math.max(hi - lo, 1);
  const seriesList = series ?? [];
  const thr = thresholds ?? { watch: 40, critical: 70 };
  const highlights = highlightIndices ?? [];

  const xOf = (i: number) => PAD.left + ((i - lo) / span) * PLOT_W;
  const yOf = (v: number) => PAD.top + (1 - v / 100) * PLOT_H;

  return (
    <div className="border border-[#1E212A] bg-[#111318] p-4">
      <div className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] mb-2">
        Comparison View · windows {lo}–{hi}
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yOf(thr.watch)} y2={yOf(thr.watch)} stroke="#818CF8" strokeOpacity={0.25} strokeDasharray="3 3" />
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yOf(thr.critical)} y2={yOf(thr.critical)} stroke="#22D3EE" strokeOpacity={0.25} strokeDasharray="3 3" />

        {highlights.map((i) =>
          i >= lo && i <= hi ? (
            <line
              key={i}
              x1={xOf(i)} x2={xOf(i)}
              y1={PAD.top} y2={HEIGHT - PAD.bottom}
              stroke="#3B82F6" strokeOpacity={0.45} strokeWidth={1.5}
            />
          ) : null
        )}

        {seriesList
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
        {seriesList.map((s) => (
          <button
            key={s.key}
            onClick={() => onToggleSeries?.(s.key)}
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