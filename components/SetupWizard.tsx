'use client';
import { useState } from 'react';
import Button from './ui/Button';
import RobotBodyMap from './RobotBodyMap';
import ScenarioChart, { Scenario } from './ScenarioChart';
import ComparisonChart from './ComparisonChart';
import { statusToSeverity, SEVERITY_COLORS, getSeverity } from '../lib/severity';
import { toDeviationIndex } from '../lib/normalize';
import { getMotorTypeLabel, getEffectiveThresholdsForMotor } from '../lib/thresholdTree';
import { generatePeerRobots, deriveThresholdFromPeer, RobotFleet } from '../lib/multiRobot';
import { Motor } from '../lib/types';
import {
  ThresholdNode,
  MOTOR_NODE_MAP,
  computeEffectiveMap,
  findNode,
  updateNodeOverride,
  diffTrees,
} from '../lib/thresholdTree';

interface SetupWizardProps {
  motors: Motor[];
  tree: ThresholdNode;
  onTreeChange: (tree: ThresholdNode) => void;
  selectedId: string;
  onSelectId: (id: string) => void;
  flashTokens: Record<string, number>;
  onFlash: (ids: string[]) => void;
}

const CATEGORY_COLORS: Record<string, string> = { 'Fan Motor': '#A78BFA', 'Pump Motor': '#FB923C', Unclassified: '#3B82F6' };

export default function SetupWizard({ motors, tree, onTreeChange, selectedId, onSelectId, onFlash }: SetupWizardProps) {
  const [draftTree, setDraftTree] = useState<ThresholdNode>(tree);
  const [peerRobots] = useState<RobotFleet[]>(() => generatePeerRobots());
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [windowRange, setWindowRange] = useState<'20' | '40' | 'all'>('all');

  const effectiveMap = computeEffectiveMap(draftTree, draftTree.override!);
  const selectedNode = findNode(draftTree, selectedId)!;

  const isMotorNode = selectedId.includes('-');
  const selectedMotor = isMotorNode ? motors.find((m) => (MOTOR_NODE_MAP[m.file] ?? 'global') === selectedId) ?? null : null;

  const handleDeploy = () => onTreeChange(draftTree);

  const changes = diffTrees(tree, draftTree);
  const changedNodeIds = new Set(changes.map((c) => c.id));

  // Peer at the same joint (same file), used for the third scenario branch.
  const matchingPeer = selectedMotor
    ? peerRobots
        .map((r) => ({ robot: r, motor: r.motors.find((m) => m.file === selectedMotor.file) }))
        .find((x) => x.motor)
    : null;

  // All peer motors at the same joint position — used for dimension comparison.
  const peerMotors = selectedMotor
    ? peerRobots
        .map((r) => r.motors.find((m) => m.file === selectedMotor.file))
        .filter((m): m is Motor => !!m)
    : [];

  const scenarios: Scenario[] = [];
  if (selectedMotor) {
    const liveThresholds = getEffectiveThresholdsForMotor(tree, selectedMotor.file);
    const draftThresholds = getEffectiveThresholdsForMotor(draftTree, selectedMotor.file);
    const draftDiffers = liveThresholds.watch !== draftThresholds.watch || liveThresholds.critical !== draftThresholds.critical;
    scenarios.push({ id: 'live', label: 'Current Policy', color: '#3B82F6', thresholds: liveThresholds, note: 'What is actually live right now.', recommended: !draftDiffers });
    if (draftDiffers) {
      scenarios.push({ id: 'draft', label: 'Draft Policy', color: '#818CF8', thresholds: draftThresholds, note: 'Your in-progress edit, not deployed yet.', recommended: true });
    }
    if (matchingPeer?.motor) {
      scenarios.push({ id: 'peer', label: `${matchingPeer.robot.robotName} Baseline`, color: '#A78BFA', thresholds: deriveThresholdFromPeer(matchingPeer.motor), note: `Derived from ${matchingPeer.robot.robotName}'s own healthy operating range.` });
    }
  }

  const fullHistory = selectedMotor ? toDeviationIndex(selectedMotor.windows.map((w) => Number(w.rms) || 0)) : [];
  const scenarioHistory = windowRange === 'all' ? fullHistory : fullHistory.slice(-Number(windowRange));

  const faultTier = (pct: number) => (pct > 20 ? '#22D3EE' : pct > 5 ? '#818CF8' : '#475569');

  const liveThresholdsForSelected = selectedMotor ? getEffectiveThresholdsForMotor(tree, selectedMotor.file) : null;
  const appliedThresholds = selectedScenario ? scenarios.find((s) => s.id === selectedScenario)?.thresholds : liveThresholdsForSelected;
  const countCritical = (hist: number[], th: { watch: number; critical: number }) =>
    hist.filter((v) => getSeverity(v, th) === 'critical').length;
  const liveCriticalCount = liveThresholdsForSelected ? countCritical(fullHistory, liveThresholdsForSelected) : 0;
  const appliedCriticalCount = appliedThresholds ? countCritical(fullHistory, appliedThresholds) : 0;

  const checklistItems = selectedMotor
    ? [
        { id: 'current', label: 'Compared against current policy', pass: true, action: null as string | null },
        { id: 'draft', label: 'Compared against draft policy', pass: !scenarios.some((s) => s.id === 'draft') || selectedScenario === 'draft', action: 'draft' },
        { id: 'peer', label: 'Compared against peer baseline', pass: !scenarios.some((s) => s.id === 'peer') || selectedScenario === 'peer', action: 'peer' },
        { id: 'spike', label: 'No critical spike vs current policy', pass: appliedCriticalCount <= liveCriticalCount, action: 'live' },
      ]
    : [];
  const allChecksPass = checklistItems.every((i) => i.pass);

  const applyScenario = (id: string) => {
    setSelectedScenario(id);
    const s = scenarios.find((sc) => sc.id === id);
    if (s) {
      setDraftTree((prev) => updateNodeOverride(prev, selectedId, s.thresholds));
      onFlash([selectedId]);
    }
  };

  return (
    <div className="flex" style={{ height: 'calc(100vh - 40px)' }}>
      {/* Left sidebar */}
      <aside className="w-72 shrink-0 border-r border-[#1E212A] bg-[#0D0F13] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E212A]">
          <span className="text-xs font-mono font-semibold text-[#D7D9E0]">Robot A ▾</span>
          <span className="text-[9px] font-mono text-[#4A4E5C]">Sync</span>
        </div>

        <div className="px-4 py-3 border-b border-[#1E212A]">
          <div className="text-sm font-mono font-semibold text-[#D7D9E0]">Robot A — Actuator Fleet</div>
          <div className="text-[10px] font-mono text-[#4A4E5C] mt-1">{motors.length}/{motors.length} actuators reporting</div>
          <div className="flex gap-1.5 mt-2">
            {motors.some((m) => statusToSeverity(m.status) === 'critical') && (
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 border border-[#22D3EE]/40 text-[#22D3EE]">
                {motors.filter((m) => statusToSeverity(m.status) === 'critical').length} Critical
              </span>
            )}
            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 border border-[#1E212A] text-[#7C8090]">Production</span>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-[#1E212A] flex gap-4">
          <span className="text-[10px] font-mono text-[#D7D9E0] border-b-2 border-[#3B82F6] pb-1.5">Overview</span>
          <span className="text-[10px] font-mono text-[#4A4E5C] pb-1.5">History</span>
        </div>

        <div className="px-3 py-3 border-b border-[#1E212A]">
          <div className="flex items-center justify-between px-2 py-2 bg-[#111318] border border-[#1E212A]">
            <span className="text-[11px] font-mono text-[#D7D9E0]">Threshold Policies</span>
            <span className="text-[10px] font-mono text-[#3B82F6]">{scenarios.length}</span>
          </div>
        </div>

        <div className="px-4 py-2 text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C]">All Motors</div>
        <div className="px-2 pb-3 flex flex-col gap-0.5">
          {motors.map((m) => {
            const sev = statusToSeverity(m.status);
            const cat = getMotorTypeLabel(m.file);
            const nodeId = MOTOR_NODE_MAP[m.file] ?? 'global';
            const changed = changedNodeIds.has(nodeId);
            return (
              <button
                key={m.file}
                onClick={() => onSelectId(nodeId)}
                className="flex items-center justify-between px-2 py-1.5 hover:bg-[#111318] transition-colors"
                style={{ background: selectedId === nodeId ? '#111318' : 'transparent' }}
              >
                <span className="text-[11px] font-mono text-[#D7D9E0]">{m.name}</span>
                <div className="flex gap-1">
                  <Dot color={SEVERITY_COLORS[sev]} title="Status" />
                  <Dot color={faultTier(m.faultPct)} title="Fault rate" />
                  <Dot color={changed ? '#3B82F6' : '#1E212A'} title="Pending change" />
                  <Dot color={CATEGORY_COLORS[cat]} title={cat} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] border-t border-[#1E212A]">Fleet Robots</div>
        <div className="px-2 pb-3 flex flex-col gap-0.5">
          {[{ robotId: 'robot-a', robotName: 'Robot A', motors, me: true }, ...peerRobots.map((r) => ({ ...r, me: false }))].map((r) => (
            <div key={r.robotId} className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[11px] font-mono text-[#D7D9E0] flex items-center gap-1.5">
                {r.robotName}
                {r.me && <span className="text-[8px] font-mono px-1 bg-[#A78BFA]/20 text-[#A78BFA]">A</span>}
              </span>
              <div className="flex gap-0.5">
                {r.motors.map((m) => (
                  <Dot key={m.file} color={SEVERITY_COLORS[statusToSeverity(m.status)]} title={m.name} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] border-t border-[#1E212A]">
          Pending Changes ({changes.length})
        </div>
        <div className="px-4 pb-3 text-[10px] font-mono text-[#4A4E5C]">
          {changes.length > 0 ? `${changes.length} node(s) not yet deployed` : 'Nothing pending'}
        </div>

        <div className="mt-auto px-4 py-3 border-t border-[#1E212A] text-[10px] font-mono text-[#4A4E5C]">Analytics</div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 relative">
          <EnvironmentBackground />
          <div className="relative text-[10px] font-mono text-[#4A4E5C]">
            ‹ Threshold Policies / {selectedMotor ? selectedMotor.name : 'Select a motor'}
          </div>

          {!selectedMotor && (
            <div className="text-[10px] font-mono text-[#4A4E5C] p-3 border border-dashed border-[#1E212A]">
              Select a motor from the left, or click a joint on the diagram.
            </div>
          )}

          {selectedMotor && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-mono font-semibold text-[#D7D9E0]">
                    Policy: {scenarios.find((s) => s.id === selectedScenario)?.label ?? 'Current Policy'}
                  </h1>
                  <div className="flex gap-4 mt-1 text-[10px] font-mono text-[#4A4E5C]">
                    <span>{getMotorTypeLabel(selectedMotor.file)}</span>
                    <span>Watch {effectiveMap[selectedId]?.watch} · Critical {effectiveMap[selectedId]?.critical}</span>
                  </div>
                </div>
                <Button variant={changedNodeIds.has(selectedId) ? 'primary' : 'secondary'} active>
                  {changedNodeIds.has(selectedId) ? 'Draft' : 'Live'}
                </Button>
              </div>

              {/* Chart — full width now that checklist lives in the right panel as an interactive form */}
              {scenarios.length > 1 ? (
                <div className="bg-[#111318] border border-[#2A2E3A]">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[#1E212A]">
                    <span className="text-xs font-mono text-[#D7D9E0]">{selectedMotor.name} — Policy Comparison</span>
                  </div>
                  <ScenarioChart
                    history={scenarioHistory}
                    scenarios={scenarios}
                    selectedId={selectedScenario}
                    onSelect={applyScenario}
                  />
                </div>
              ) : (
                <div className="text-[10px] font-mono text-[#4A4E5C] p-3 border border-dashed border-[#1E212A]">
                  No alternate policies to compare — nothing pending for this motor.
                </div>
              )}

              <div className="flex gap-1 border-b border-[#1E212A]">
                {(['20', '40', 'all'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setWindowRange(r)}
                    className="text-[10px] font-mono uppercase px-3 py-2 border-b-2"
                    style={{ borderColor: windowRange === r ? '#3B82F6' : 'transparent', color: windowRange === r ? '#3B82F6' : '#7C8090' }}
                  >
                    {r === 'all' ? 'All windows' : `Last ${r} windows`}
                  </button>
                ))}
              </div>

              {peerMotors.length > 0 && (
                <ComparisonChart dimensions={{ primary: selectedMotor, peers: peerMotors }} />
              )}

              <div className="border border-[#1E212A]">
                <div className="grid grid-cols-[1fr_90px_90px_90px] gap-3 px-3 py-2 border-b border-[#1E212A] text-[9px] font-mono uppercase text-[#4A4E5C]">
                  <span>Feature</span><span className="text-right">Before</span><span className="text-right">Change</span><span className="text-right">Result</span>
                </div>
                {[
                  { label: 'RMS (avg)', val: selectedMotor.avgRms },
                  { label: 'Kurtosis (avg)', val: selectedMotor.avgKurt },
                  { label: 'Crest Factor (avg)', val: selectedMotor.avgCrest },
                  { label: 'Peak (avg)', val: selectedMotor.avgPeak },
                ].map((f) => (
                  <div key={f.label} className="grid grid-cols-[1fr_90px_90px_90px] gap-3 items-center px-3 py-1.5 border-b border-[#15171D] last:border-b-0">
                    <span className="text-xs font-mono text-[#D7D9E0]">{f.label}</span>
                    <span className="text-right text-xs font-mono tabular-nums px-1.5" style={{ background: `${faultTier(selectedMotor.faultPct)}18`, color: faultTier(selectedMotor.faultPct) }}>
                      {f.val.toFixed(3)}
                    </span>
                    <span className="text-right text-xs font-mono text-[#3B82F6] tabular-nums">—</span>
                    <span className="text-right text-xs font-mono text-[#D7D9E0] tabular-nums">{f.val.toFixed(3)}</span>
                  </div>
                ))}
              </div>

              <Button variant="primary" onClick={handleDeploy} disabled={changes.length === 0 || !allChecksPass}>
                Save policy
              </Button>
              {changes.length > 0 && !allChecksPass && (
                <div className="text-[10px] font-mono text-[#22D3EE]">Resolve the failing checklist item before deploying.</div>
              )}
            </>
          )}
        </div>

        {/* Right: window data lists + body diagram */}
        <div className="w-96 shrink-0 border-l border-[#1E212A] overflow-y-auto flex flex-col">
          {selectedMotor && checklistItems.length > 0 && (
            <div className="p-3 border-b border-[#1E212A] flex flex-col gap-2">
              <div className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] mb-1">Checklist</div>
              {checklistItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-1 border border-[#1E212A] p-2">
                  <div className="flex items-center gap-2 text-xs font-mono" style={{ color: item.pass ? '#475569' : '#22D3EE' }}>
                    <span>{item.pass ? '✓' : '✕'}</span>
                    {item.label}
                  </div>
                  {!item.pass && item.action && (
                    <Button size="sm" variant="primary" onClick={() => applyScenario(item.action!)}>
                      {item.action === 'live' ? 'Revert to current policy' : `Apply ${scenarios.find((s) => s.id === item.action)?.label ?? item.action}`}
                    </Button>
                  )}
                </div>
              ))}
              {!allChecksPass && (
                <div className="text-[10px] font-mono text-[#22D3EE] mt-1">
                  Resolve every check before Save policy unlocks.
                </div>
              )}
            </div>
          )}

          <div className="p-3">
            <RobotBodyMap
              motors={motors}
              colorMode="category"
              selectedMotor={selectedMotor}
              onSelectMotor={(m) => onSelectId(MOTOR_NODE_MAP[m.file] ?? 'global')}
              onSelectCategory={onSelectId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * References a real photo at /public/environment-bg.jpg (add this file to
 * your project yourself — it can't be embedded by generated code). Falls
 * back to a plain dark panel with a note if the file isn't there yet, so a
 * missing image never breaks the layout.
 */
function EnvironmentBackground() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      {!failed ? (
        <img
          src="/environment-bg.jpg"
          alt=""
          className="w-full h-full object-cover opacity-30"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#0A0B0D]">
          <span className="text-[10px] font-mono text-[#2A2E3A]">
            Add an image at /public/environment-bg.jpg to show it here
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B0D] via-[#0A0B0D]/60 to-[#0A0B0D]/20" />
    </div>
  );
}

function Dot({ color, title }: { color: string; title: string }) {
  return <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} title={title} />;
}