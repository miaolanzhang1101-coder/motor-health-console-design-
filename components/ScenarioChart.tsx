'use client';
import { useState } from 'react';
import { ThresholdValues } from '../lib/thresholdTree';

export interface Scenario {
  id: string;
  label: string;
  color: string;
  thresholds: ThresholdValues;
  note: string;
  recommended?: boolean;
}

interface ScenarioChartProps {
  history: number[]; // real historical deviation index (0-100)
  scenarios: Scenario[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const WIDTH = 700;
const HEIGHT = 220;
const PAD = { top: 16, bottom: 24, left: 8, right: 8 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const PROJECTION_WINDOWS = 20;
const TREND_LOOKBACK = 10;

export default function ScenarioChart({ history, scenarios, selectedId, onSelect }: ScenarioChartProps) {
  const lastIndex = history.length - 1;
  const lookback = Math.min(TREND_LOOKBACK, history.length);
  const recent = history.slice(-lookback);
  // Naive linear trend over the recent window — explicitly not a forecasting
  // model, just "if this kept moving the way it just moved."
  const rate = lookback > 1 ? (recent[recent.length - 1] - recent[0]) / (lookback - 1) : 0;
  const lastValue = history[lastIndex] ?? 0;
  const totalX = lastIndex + PROJECTION_WINDOWS;

  const xOf = (i: number) => PAD.left + (i / totalX) * PLOT_W;
  const yOf = (v: number) => PAD.top + (1 - Math.min(Math.max(v, 0), 100) / 100) * PLOT_H;

  const historyPts = history.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
  const projEndVal = Math.min(100, Math.max(0, lastValue + rate * PROJECTION_WINDOWS));
  const projPts = `${xOf(lastIndex)},${yOf(lastValue)} ${xOf(lastIndex + PROJECTION_WINDOWS)},${yOf(projEndVal)}`;

  function crossing(thresholdVal: number): { x: number; y: number; offRange: boolean } {
    if (rate <= 0 || thresholdVal <= lastValue) {
      return { x: xOf(lastIndex + PROJECTION_WINDOWS), y: yOf(projEndVal), offRange: true };
    }
    const windowsNeeded = (thresholdVal - lastValue) / rate;
    if (windowsNeeded > PROJECTION_WINDOWS) {
      return { x: xOf(lastIndex + PROJECTION_WINDOWS), y: yOf(projEndVal), offRange: true };
    }
    return { x: xOf(lastIndex + windowsNeeded), y: yOf(thresholdVal), offRange: false };
  }

  return (
    <div className="border border-[#1E212A] bg-[#111318] p-4">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
        <defs>
          <linearGradient id="scenario-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
          </linearGradient>
        </defs>

        <polygon points={`${historyPts} ${xOf(lastIndex)},${HEIGHT - PAD.bottom} ${xOf(0)},${HEIGHT - PAD.bottom}`} fill="url(#scenario-fill)" />
        <polyline points={historyPts} fill="none" stroke="#22D3EE" strokeWidth={1.75} />

        <line x1={xOf(lastIndex)} x2={xOf(lastIndex)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#2A2E3A" strokeDasharray="2 2" />
        <text x={xOf(lastIndex)} y={PAD.top - 4} textAnchor="middle" fontSize={8} fontFamily="monospace" fill="#4A4E5C">now</text>

        <polyline points={projPts} fill="none" stroke="#4A4E5C" strokeWidth={1.5} strokeDasharray="4 3" />

        {scenarios.map((s, i) => {
          const c = crossing(s.thresholds.critical);
          const selected = selectedId === s.id;
          return (
            <g key={s.id} onClick={() => onSelect(s.id)} className="cursor-pointer">
              <line
                x1={PAD.left} x2={WIDTH - PAD.right}
                y1={yOf(s.thresholds.critical)} y2={yOf(s.thresholds.critical)}
                stroke={s.color} strokeOpacity={selected ? 0.35 : 0.15} strokeDasharray="2 2"
              />
              <circle cx={c.x} cy={c.y} r={selected ? 11 : 9} fill="#0A0B0D" stroke={s.color} strokeWidth={selected ? 2.5 : 1.5} />
              <text x={c.x} y={c.y + 3} textAnchor="middle" fontSize={9} fontFamily="monospace" fontWeight={700} fill={s.color}>
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-col gap-2 mt-3">
        {scenarios.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="flex items-start gap-2.5 text-left p-2 border transition-colors"
            style={{
              borderColor: selectedId === s.id ? s.color : '#1E212A',
              background: selectedId === s.id ? `${s.color}0F` : 'transparent',
            }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono font-bold shrink-0 mt-0.5"
              style={{ border: `1.5px solid ${s.color}`, color: s.color }}
            >
              {i + 1}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-[#D7D9E0]">{s.label}</span>
                {s.recommended && (
                  <span className="text-[8px] font-mono uppercase text-[#475569] border border-[#475569]/40 px-1.5 py-0.5">
                    Recommended
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-[#7C8090] mt-0.5">{s.note}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}