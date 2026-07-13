'use client';
import { useState } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import StatCard from './ui/StatCard';
import Input from './ui/Input';
import SeverityBadge from './SeverityBadge';
import RobotBodyMap from './RobotBodyMap';
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
}

const CATEGORIES = ['All', 'Fan Motor', 'Pump Motor', 'Unclassified'];
const CATEGORY_COLORS: Record<string, string> = {
  'Fan Motor': '#A78BFA',
  'Pump Motor': '#FB923C',
  Unclassified: '#4A4E5C',
};

type CardId = 'filter' | 'stats' | 'table' | 'body' | 'bars' | 'heatmap' | 'pipeline';

const CARD_META: Record<CardId, { title: string; dependsOn: string[] }> = {
  filter: { title: 'Filtered Fleet', dependsOn: ['Fleet Console'] },
  stats: { title: 'RMS Range', dependsOn: ['Filtered Fleet'] },
  table: { title: 'Motor Table', dependsOn: ['Filtered Fleet'] },
  body: { title: 'Fleet as Actuators', dependsOn: ['Filtered Fleet'] },
  bars: { title: 'Faults by Category', dependsOn: ['Filtered Fleet'] },
  heatmap: { title: 'RMS × Kurtosis Density', dependsOn: ['Filtered Fleet'] },
  pipeline: { title: 'Data Pipeline', dependsOn: ['Uploaded CSV'] },
};

const PIPELINE_STEPS = [
  'Uploaded CSV rows',
  'Grouped by motor file',
  'Per-window feature averages (RMS, kurtosis, crest, peak)',
  'Fault % → status classification',
  'Threshold tree lookup (category → motor override)',
];

export default function AnalysisCanvas({
  motors,
  onOpenInspector,
  actions,
  onActionChange,
  thresholdTree,
  onThresholdOverrideChange,
}: AnalysisCanvasProps) {
  const [filter, setFilter] = useState<FleetFilter>({ category: 'All', minFaultRate: 0 });
  const [selectedCard, setSelectedCard] = useState<CardId | null>(null);
  const [selectedMotor, setSelectedMotor] = useState<Motor | null>(null);

  const filtered = filterMotors(motors, filter);
  const categoryCounts = computeCategoryCounts(filtered);
  const heatmap = computeHeatmap(filtered);
  const allRms = filtered.flatMap((m) => m.windows.map((w) => Number(w.rms) || 0));
  const minRms = allRms.length ? Math.min(...allRms) : 0;
  const maxRms = allRms.length ? Math.max(...allRms) : 0;

  const selectMotor = (m: Motor) => {
    setSelectedMotor(m);
    setSelectedCard(null);
  };
  const selectCard = (id: CardId) => {
    setSelectedCard(id);
    setSelectedMotor(null);
  };

  // threshold lookups for the currently selected motor (Body Map / Table quick edit)
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
        <div className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] px-1.5 py-1">
          Canvas Contents
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
          <StatCard label="Min RMS (raw)" value={minRms.toFixed(3)} />
          <StatCard label="Max RMS (raw)" value={maxRms.toFixed(3)} />
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

        {/* Body map card */}
        <div style={{ gridColumn: 'span 2' }}>
          <div onClick={() => selectCard('body')}>
            <RobotBodyMap motors={filtered} selectedMotor={selectedMotor} onSelectMotor={selectMotor} />
          </div>
        </div>

        <CardShell id="bars" span={1}>
          <BarChart data={categoryCounts} />
        </CardShell>

        <CardShell id="heatmap" span={2}>
          <Heatmap data={heatmap} />
        </CardShell>

        <CardShell id="pipeline" span={1}>
          <div className="flex flex-col gap-1.5">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={i} className="text-[10px] font-mono text-[#7C8090] flex gap-1.5">
                <span className="text-[#3B82F6]">{i + 1}.</span>
                {step}
              </div>
            ))}
          </div>
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
            <rect x={x} y={h - 20 - faultH} width={barW} height={faultH} fill="#EF4444" fillOpacity={0.7} />
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