'use client';
import { useState } from 'react';
import Button from './ui/Button';
import RobotBodyMap from './RobotBodyMap';
import ScenarioChart, { Scenario } from './ScenarioChart';
import { statusToSeverity, SEVERITY_COLORS } from '../lib/severity';
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
  const [popupOpen, setPopupOpen] = useState(true);
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

  const scenarios: Scenario[] = [];
  if (selectedMotor) {
    const liveThresholds = getEffectiveThresholdsForMotor(tree, selectedMotor.file);
    const draftThresholds = getEffectiveThresholdsForMotor(draftTree, selectedMotor.file);
    const draftDiffers = liveThresholds.watch !== draftThresholds.watch || liveThresholds.critical !== draftThresholds.critical;
    scenarios.push({ id: 'live', label: 'Current Policy', color: '#3B82F6', thresholds: liveThresholds, note: 'What is actually live right now.', recommended: !draftDiffers });
    if (draftDiffers) {
      scenarios.push({ id: 'draft', label: 'Draft Policy', color: '#F59E0B', thresholds: draftThresholds, note: 'Your in-progress edit, not deployed yet.', recommended: true });
    }
    if (matchingPeer?.motor) {
      scenarios.push({ id: 'peer', label: `${matchingPeer.robot.robotName} Baseline`, color: '#A78BFA', thresholds: deriveThresholdFromPeer(matchingPeer.motor), note: `Derived from ${matchingPeer.robot.robotName}'s own healthy operating range.` });
    }
  }

  const fullHistory = selectedMotor ? toDeviationIndex(selectedMotor.windows.map((w) => Number(w.rms) || 0)) : [];
  const scenarioHistory = windowRange === 'all' ? fullHistory : fullHistory.slice(-Number(windowRange));

  const faultTier = (pct: number) => (pct > 20 ? '#EF4444' : pct > 5 ? '#F59E0B' : '#22C55E');

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
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 border border-[#EF4444]/40 text-[#EF4444]">
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
          <div className="text-[10px] font-mono text-[#4A4E5C]">
            ‹ Threshold Policies / {selectedMotor ? selectedMotor.name : 'Select a motor'}
          </div>

          {selectedMotor ? (
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

              {/* Expandable feature table, styled like the reference's resource table */}
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

              <Button variant="primary" onClick={handleDeploy} disabled={changes.length === 0}>Push Deploy</Button>
            </>
          ) : (
            <div className="text-[10px] font-mono text-[#4A4E5C] p-3 border border-dashed border-[#1E212A]">
              Select a motor from the left, or click a joint on the diagram.
            </div>
          )}

          {/* Floating popup — the scenario chart, positioned like the reference's overlay card */}
          {popupOpen && selectedMotor && scenarios.length > 1 && (
            <div className="absolute left-4 bottom-4 w-[440px] bg-[#111318] border border-[#2A2E3A] shadow-lg">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#1E212A]">
                <span className="text-xs font-mono text-[#D7D9E0]">{selectedMotor.name} — Policy Comparison</span>
                <div className="flex items-center gap-2">
                  <button className="text-[9px] font-mono text-[#3B82F6]">View as Page</button>
                  <button onClick={() => setPopupOpen(false)} className="text-[#4A4E5C] hover:text-[#D7D9E0] text-xs">✕</button>
                </div>
              </div>
              <ScenarioChart
                history={scenarioHistory}
                scenarios={scenarios}
                selectedId={selectedScenario}
                onSelect={(id) => {
                  setSelectedScenario(id);
                  const s = scenarios.find((sc) => sc.id === id);
                  if (s) {
                    setDraftTree((prev) => updateNodeOverride(prev, selectedId, s.thresholds));
                    onFlash([selectedId]);
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Right: body diagram standing in for the map */}
        <div className="w-96 shrink-0 border-l border-[#1E212A] p-3 overflow-y-auto">
          <RobotBodyMap
            motors={motors}
            colorMode="category"
            selectedMotor={selectedMotor}
            onSelectMotor={(m) => {
              onSelectId(MOTOR_NODE_MAP[m.file] ?? 'global');
              setPopupOpen(true);
            }}
            onSelectCategory={onSelectId}
          />
        </div>
      </div>
    </div>
  );
}

function Dot({ color, title }: { color: string; title: string }) {
  return <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} title={title} />;
}