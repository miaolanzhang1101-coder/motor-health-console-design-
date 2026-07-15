'use client';
import { useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import StatCard from './ui/StatCard';
import Input from './ui/Input';
import SeverityBadge from './SeverityBadge';
import MotorPropertyPanel from './MotorPropertyPanel';
import { statusToSeverity, SEVERITY_COLORS } from '../lib/severity';
import { toDeviationIndex } from '../lib/normalize';
import { Motor, ActionState } from '../lib/types';
import { ThresholdNode, ThresholdValues, MOTOR_NODE_MAP, computeEffectiveMap, findNode, findParentNode } from '../lib/thresholdTree';
import { filterMotors, computeCategoryCounts, computeHeatmap, FleetFilter } from '../lib/analysis';

interface AnalysisCanvasProps {
  motors: Motor[];
  onOpenInspector: (motor: Motor) => void;
  actions: Record<string, ActionState>;
  onActionChange: (motorFile: string, action: ActionState) => void;
  thresholdTree?: ThresholdNode;
  onThresholdOverrideChange?: (nodeId: string, override: ThresholdValues | null) => void;
  isStreaming?: boolean;
  streamingMotor?: Motor | null;
}

const CATEGORIES = ['All', 'Fan Motor', 'Pump Motor', 'Unclassified'];
const CATEGORY_COLORS: Record<string, string> = {
  'Fan Motor': '#A78BFA',
  'Pump Motor': '#FB923C',
  Unclassified: '#4A4E5C',
};

type CardId = 'filter' | 'health' | 'table' | 'alerts' | 'bars' | 'heatmap' | 'livefeed' | 'trend' | 'band';

const CARD_META: Record<CardId, { title: string; dependsOn: string[] }> = {
  filter: { title: 'Filtered Fleet', dependsOn: ['Fleet Console'] },
  health: { title: 'System Health', dependsOn: ['Filtered Fleet'] },
  table: { title: 'Motor Table', dependsOn: ['Filtered Fleet'] },
  alerts: { title: 'Safety Critical Alerts', dependsOn: ['Filtered Fleet'] },
  bars: { title: 'Faults by Category', dependsOn: ['Filtered Fleet'] },
  heatmap: { title: 'RMS × Kurtosis Density', dependsOn: ['Filtered Fleet'] },
  livefeed: { title: 'Live Feed', dependsOn: ['Live Stream'] },
  trend: { title: 'Fleet Trend Comparison', dependsOn: ['Filtered Fleet'] },
  band: { title: 'Fleet Signal Band', dependsOn: ['Filtered Fleet'] },
};

const TREND_COLORS = ['#22D3EE', '#A78BFA', '#FB923C', '#4ADE80', '#22D3EE', '#3B82F6', '#818CF8'];

export default function AnalysisCanvas({
  motors,
  onOpenInspector,
  actions,
  onActionChange,
  thresholdTree,
  onThresholdOverrideChange,
  isStreaming = false,
  streamingMotor = null,
}: AnalysisCanvasProps) {
  const [filter, setFilter] = useState<FleetFilter>({ category: 'All', minFaultRate: 0 });
  const [selectedCard, setSelectedCard] = useState<CardId | null>(null);
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);

  const filtered = filterMotors(motors, filter);
  const categoryCounts = computeCategoryCounts(filtered);
  const heatmap = computeHeatmap(filtered);

  const healthyCount = filtered.filter((m) => statusToSeverity(m.status) === 'healthy').length;
  const healthScore = filtered.length ? Math.round((healthyCount / filtered.length) * 100) : 100;
  const avgFaultRate = filtered.length ? filtered.reduce((s, m) => s + m.faultPct, 0) / filtered.length : 0;
  const efficiency = Math.max(0, Math.round(100 - avgFaultRate));
  const criticalMotors = filtered
    .filter((m) => statusToSeverity(m.status) === 'critical')
    .sort((a, b) => b.faultPct - a.faultPct);

  const selectMotor = (m: Motor) => {
    setSelectedMotor(m);
    setSelectedCard(null);
  };
  const selectCard = (id: CardId) => {
    setSelectedCard(id);
    setSelectedMotor(null);
  };

  const nodeId = selectedMotor ? MOTOR_NODE_MAP[selectedMotor.file] ?? 'global' : null;
  const node = nodeId && thresholdTree ? findNode(thresholdTree, nodeId) : null;
  const parent = nodeId && thresholdTree ? findParentNode(thresholdTree, nodeId) : null;
  const effectiveMap = thresholdTree ? computeEffectiveMap(thresholdTree, thresholdTree.override!) : {};
  const baseline = parent ? effectiveMap[parent.id] : node ? effectiveMap[node.id] : undefined;
  const effective = node ? effectiveMap[node.id] : undefined;
  const hasOverride = node?.override !== null && node?.override !== undefined;
  const motorAction = selectedMotor ? actions[selectedMotor.file] ?? 'none' : 'none';

  const CONTENTS: { id: CardId; label: string }[] = Object.entries(CARD_META).map(([id, m]) => ({
    id: id as CardId,
    label: m.title,
  }));

  const CardShell = ({ id, span = 1, children }: { id: CardId; span?: number; children: React.ReactNode }) => (
    <button onClick={() => selectCard(id)} className="text-left" style={{ gridColumn: `span ${span}` }}>
      <Card className="h-full">
        <div
          className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] mb-2 pb-2 border-b"
          style={{ borderColor: selectedCard === id ? '#3B82F6' : '#1E212A' }}
        >
          {CARD_META[id].title}
        </div>
        {children}
      </Card>
    </button>
  );

  return (
    <div className="grid grid-cols-[180px_1fr_280px] gap-3">
      {/* Left: analysis contents */}
      <div className="border border-[#1E212A] bg-[#111318] p-2 flex flex-col gap-0.5 self-start">
        <div className="flex items-center justify-between px-1.5 py-1">
          <span className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C]">Canvas Contents</span>
          {isStreaming && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22D3EE] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22D3EE]" />
            </span>
          )}
        </div>
        {CONTENTS.map((c) => (
          <button
            key={c.id}
            onClick={() => selectCard(c.id)}
            className="text-left text-[10px] font-mono px-1.5 py-1 hover:bg-[#15171D] transition-colors"
            style={{ color: selectedCard === c.id ? '#3B82F6' : '#7C8090' }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Main canvas */}
      <div className="grid grid-cols-3 gap-3 auto-rows-min">
        <CardShell id="filter" span={2}>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#7C8090]">
            <span>Keep motors where</span>
            <select
              value={filter.category}
              onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
              className="bg-[#0D0F13] border border-[#1E212A] px-2 py-1 text-[#D7D9E0] focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span>and Fault Rate ≥</span>
            <div className="w-16">
              <Input type="number" value={filter.minFaultRate} onChange={(v) => setFilter((f) => ({ ...f, minFaultRate: Number(v) }))} />
            </div>
            <span>%</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-[#4A4E5C]">
            {filtered.length} of {motors.length} motors match
          </div>
        </CardShell>

        <div className="flex flex-col gap-3">
          <StatCard label="System Health" value={`${healthScore}%`} color={healthScore >= 80 ? '#475569' : healthScore >= 50 ? '#818CF8' : '#22D3EE'} />
          <StatCard label="Operational Efficiency" value={`${efficiency}%`} />
        </div>

        {/* Motor table card */}
        <div style={{ gridColumn: 'span 3' }}>
          <Card padded={false}>
            <div
              className="px-3 py-2 border-b text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] cursor-pointer"
              style={{ borderColor: selectedCard === 'table' ? '#3B82F6' : '#1E212A' }}
              onClick={() => selectCard('table')}
            >
              Motor Table
            </div>
            <div className="grid grid-cols-[1fr_80px_80px_80px_100px] gap-3 px-3 py-1.5 border-b border-[#15171D] text-[9px] font-mono uppercase text-[#4A4E5C]">
              <span>Motor</span>
              <span className="text-right">Fault %</span>
              <span className="text-right">RMS</span>
              <span className="text-right">Kurt</span>
              <span>Status</span>
            </div>
            {filtered.map((m) => {
              const sev = statusToSeverity(m.status);
              const color = SEVERITY_COLORS[sev];
              return (
                <button
                  key={m.file}
                  onClick={() => selectMotor(m)}
                  className="w-full grid grid-cols-[1fr_80px_80px_80px_100px] gap-3 items-center px-3 py-1.5 border-b border-[#15171D] last:border-b-0 text-left hover:bg-[#15171D] transition-colors"
                  style={{
                    background: selectedMotor?.file === m.file ? '#15171D' : 'transparent',
                    borderLeft: `2px solid ${selectedMotor?.file === m.file ? color : 'transparent'}`,
                  }}
                >
                  <span className="text-xs font-mono text-[#D7D9E0]">{m.name}</span>
                  <span className="text-right text-xs font-mono text-[#D7D9E0] tabular-nums">{m.faultPct.toFixed(1)}%</span>
                  <span className="text-right text-xs font-mono text-[#7C8090] tabular-nums">{m.avgRms.toFixed(2)}</span>
                  <span className="text-right text-xs font-mono text-[#7C8090] tabular-nums">{m.avgKurt.toFixed(2)}</span>
                  <SeverityBadge level={sev} size="sm" />
                </button>
              );
            })}
          </Card>
        </div>

        {/* Safety Critical Alerts — plain Card, not CardShell, since it contains real interactive buttons */}
        <div style={{ gridColumn: 'span 2' }}>
          <Card padded={false}>
            <div
              className="px-3 py-2 border-b text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] cursor-pointer"
              style={{ borderColor: selectedCard === 'alerts' ? '#3B82F6' : '#1E212A' }}
              onClick={() => selectCard('alerts')}
            >
              Safety Critical Alerts
            </div>
            <div className="p-3">
              {criticalMotors.length === 0 ? (
                <div className="text-[10px] font-mono text-[#4A4E5C]">No active safety-critical alerts.</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {criticalMotors.map((m) => (
                    <div key={m.file} className="flex items-center justify-between border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-2.5 py-1.5">
                      <button onClick={() => selectMotor(m)} className="flex items-center gap-2 text-left">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22D3EE] opacity-60" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22D3EE]" />
                        </span>
                        <span className="text-xs font-mono text-[#D7D9E0]">{m.name}</span>
                        <span className="text-[10px] font-mono text-[#7C8090]">{m.faultPct.toFixed(1)}% fault rate</span>
                      </button>
                      <Button size="sm" variant="danger" onClick={() => onActionChange(m.file, 'escalated')}>
                        Escalate
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <CardShell id="bars" span={1}>
          <BarChart data={categoryCounts} />
        </CardShell>

        <CardShell id="heatmap" span={2}>
          <Heatmap data={heatmap} />
        </CardShell>

        <CardShell id="livefeed" span={1}>
          <LiveFeed motor={streamingMotor} isStreaming={isStreaming} />
        </CardShell>

        <CardShell id="trend" span={3}>
          <TrendComparison motors={filtered} />
        </CardShell>

        <CardShell id="band" span={3}>
          <RollingBandChart motors={filtered} />
        </CardShell>
      </div>

      {/* Right inspector */}
      <div>
        {selectedMotor ? (
          <MotorPropertyPanel
            motor={selectedMotor}
            allMotors={motors}
            action={motorAction}
            onActionChange={(a) => onActionChange(selectedMotor.file, a)}
            onOpenInspector={() => onOpenInspector(selectedMotor)}
            baseline={baseline}
            effective={effective}
            hasOwnOverride={hasOverride}
            onThresholdChange={(override) => nodeId && onThresholdOverrideChange?.(nodeId, override)}
          />
        ) : selectedCard ? (
          <Card>
            <div className="text-sm font-mono font-semibold text-[#D7D9E0] mb-1">{CARD_META[selectedCard].title}</div>
            <div className="text-[10px] font-mono text-[#4A4E5C] mb-3">Card configuration</div>
            <div className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] mb-1.5">Dependencies</div>
            <div className="flex flex-col gap-1">
              {CARD_META[selectedCard].dependsOn.map((dep) => (
                <div key={dep} className="text-[10px] font-mono text-[#7C8090] border border-[#1E212A] px-2 py-1">
                  ↑ {dep}
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <div className="border border-dashed border-[#1E212A] p-4 text-[10px] font-mono text-[#4A4E5C]">
            Click a card or motor to inspect it.
          </div>
        )}
      </div>
    </div>
  );
}

function BarChart({ data }: { data: { category: string; faults: number; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const w = 260, h = 140, barW = 40, gap = 30;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {data.map((d, i) => {
        const x = 20 + i * (barW + gap);
        const totalH = (d.total / max) * (h - 30);
        const faultH = (d.faults / max) * (h - 30);
        const color = CATEGORY_COLORS[d.category];
        return (
          <g key={d.category}>
            <rect x={x} y={h - 20 - totalH} width={barW} height={totalH} fill={`${color}33`} stroke={color} strokeWidth={1} />
            <rect x={x} y={h - 20 - faultH} width={barW} height={faultH} fill="#22D3EE" fillOpacity={0.7} />
            <text x={x + barW / 2} y={h - 6} textAnchor="middle" fontSize={7} fontFamily="monospace" fill="#7C8090">
              {d.category.replace(' Motor', '')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Heatmap({ data }: { data: ReturnType<typeof computeHeatmap> }) {
  if (data.grid.length === 0) return <div className="text-[10px] font-mono text-[#4A4E5C]">no data</div>;
  const bins = data.grid.length;
  const cell = 24;
  return (
    <svg viewBox={`0 0 ${bins * cell} ${bins * cell}`} className="w-full h-auto max-w-[220px]">
      {data.grid.map((row, kb) =>
        row.map((count, rb) => (
          <rect
            key={`${kb}-${rb}`}
            x={rb * cell} y={(bins - 1 - kb) * cell}
            width={cell} height={cell}
            fill="#3B82F6"
            fillOpacity={count / data.max}
            stroke="#0A0B0D"
            strokeWidth={0.5}
          />
        ))
      )}
    </svg>
  );
}

function TrendComparison({ motors }: { motors: Motor[] }) {
  if (motors.length === 0) return <div className="text-[10px] font-mono text-[#4A4E5C]">no motors match the filter</div>;
  const w = 720, h = 140;
  const series = motors.map((m, i) => ({
    name: m.name,
    color: TREND_COLORS[i % TREND_COLORS.length],
    values: toDeviationIndex(m.windows.map((win) => Number(win.rms) || 0)),
  }));

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        {series.map((s) => {
          const pts = s.values.map((v, i) => `${(i / (s.values.length - 1 || 1)) * w},${h - (v / 100) * h}`).join(' ');
          return <polyline key={s.name} points={pts} fill="none" stroke={s.color} strokeWidth={1.25} strokeOpacity={0.85} />;
        })}
      </svg>
      <div className="flex gap-3 flex-wrap mt-1">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1 text-[9px] font-mono text-[#7C8090]">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Fleet-wide mean RMS deviation per window index, with a ±1 standard
 * deviation band across motors at that index — real statistics computed
 * from the actual filtered fleet, not styled to look complex. */
function RollingBandChart({ motors }: { motors: Motor[] }) {
  if (motors.length === 0) return <div className="text-[10px] font-mono text-[#4A4E5C]">no motors match the filter</div>;
  const w = 720, h = 180;
  const devSeries = motors.map((m) => toDeviationIndex(m.windows.map((win) => Number(win.rms) || 0)));
  const maxLen = Math.max(...devSeries.map((s) => s.length));

  const mean: number[] = [];
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < maxLen; i++) {
    const vals = devSeries.map((s) => s[i]).filter((v): v is number => v !== undefined);
    if (vals.length === 0) continue;
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length;
    const std = Math.sqrt(variance);
    mean.push(m);
    upper.push(Math.min(100, m + std));
    lower.push(Math.max(0, m - std));
  }

  const x = (i: number) => (i / (mean.length - 1 || 1)) * w;
  const y = (v: number) => h - (v / 100) * h;
  const bandPath = `M ${upper.map((v, i) => `${x(i)},${y(v)}`).join(' L ')} L ${lower
    .map((v, i) => `${x(mean.length - 1 - i)},${y(v)}`)
    .reverse()
    .join(' L ')} Z`;
  const meanPath = mean.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <path d={bandPath} fill="#3B82F6" fillOpacity={0.12} />
      <polyline points={meanPath} fill="none" stroke="#3B82F6" strokeWidth={1.5} />
    </svg>
  );
}

/** A live ticker showing the most recent windows appended while the
 * selected motor is streaming — real data appended over real HTTP calls,
 * shown newest-first. */
function LiveFeed({ motor, isStreaming }: { motor: Motor | null; isStreaming: boolean }) {
  if (!motor) {
    return (
      <div className="text-[10px] font-mono text-[#4A4E5C]">
        Select a motor and enable Live Stream to see incoming windows here.
      </div>
    );
  }
  const recent = motor.windows.slice(-8).reverse();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: isStreaming ? '#22D3EE' : '#2A2E3A' }}
        />
        <span className="text-[9px] font-mono text-[#7C8090]">
          {isStreaming ? `streaming ${motor.name}` : 'not streaming'}
        </span>
      </div>
      {recent.map((w, i) => (
        <div key={i} className="flex justify-between text-[10px] font-mono">
          <span className="text-[#4A4E5C]">#{motor.windows.length - i}</span>
          <span className="text-[#D7D9E0] tabular-nums">rms {Number(w.rms).toFixed(3)}</span>
          <span style={{ color: w.label === 'fault' ? '#22D3EE' : '#4A4E5C' }}>{w.label}</span>
        </div>
      ))}
    </div>
  );
}