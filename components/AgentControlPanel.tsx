'use client';
import { useState } from 'react';
import Checkbox from './ui/Checkbox';
import Stepper from './ui/Stepper';
import { Agent } from '../lib/agentStream';

interface AgentControlPanelProps {
  agent: Agent;
  onChange: (patch: Partial<Agent>) => void;
  onClose: () => void;
}

const DEFAULTS = { patrolSpeed: 6, returnSpeed: 3, useReturnSpeed: false, waypointTolerance: 5 };

export default function AgentControlPanel({ agent, onChange, onClose }: AgentControlPanelProps) {
  const [tab, setTab] = useState<'status' | 'movement'>('movement');

  return (
    <div className="absolute top-4 right-4 w-72 bg-[#111318] border border-[#2A2E3A] shadow-lg z-[1000]">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1E212A]">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 flex items-center justify-center border border-[#3B82F6]/40 bg-[#3B82F6]/10 text-[9px] font-mono text-[#3B82F6]">
            {agent.kind === 'Drone' ? 'DR' : 'AMR'}
          </span>
          <span className="text-xs font-mono font-semibold text-[#D7D9E0]">{agent.name}</span>
        </div>
        <button onClick={onClose} className="text-[#4A4E5C] hover:text-[#D7D9E0] text-sm">✕</button>
      </div>

      <div className="flex gap-4 px-3 pt-2 border-b border-[#1E212A]">
        <button
          onClick={() => setTab('status')}
          className="text-[11px] font-mono uppercase pb-2 border-b-2"
          style={{ borderColor: tab === 'status' ? '#3B82F6' : 'transparent', color: tab === 'status' ? '#3B82F6' : '#7C8090' }}
        >
          Status
        </button>
        <button
          onClick={() => setTab('movement')}
          className="text-[11px] font-mono uppercase pb-2 border-b-2"
          style={{ borderColor: tab === 'movement' ? '#3B82F6' : 'transparent', color: tab === 'movement' ? '#3B82F6' : '#7C8090' }}
        >
          Movement
        </button>
      </div>

      {tab === 'status' ? (
        <div className="p-3 flex flex-col gap-1.5 text-[10px] font-mono">
          <Row label="Kind" value={agent.kind} />
          <Row label="Status" value={agent.status} />
          <Row label="Battery" value={`${Math.round(agent.battery)}%`} />
          <Row label="Heading" value={`${Math.round(agent.heading)}°`} />
        </div>
      ) : (
        <div className="p-3 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wide text-[#4A4E5C]">Set Agent Speed</span>
            <button
              onClick={() => onChange(DEFAULTS)}
              className="text-[10px] font-mono text-[#3B82F6] hover:underline"
            >
              Reset
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <Checkbox checked label="During Patrol" onChange={() => {}} />
            <Stepper value={agent.patrolSpeed} onChange={(v) => onChange({ patrolSpeed: v })} unit="m/s" min={1} max={20} />
          </div>

          <div className="flex flex-col gap-2">
            <Checkbox
              checked={agent.useReturnSpeed}
              label="During Return-to-Base"
              onChange={(checked) => onChange({ useReturnSpeed: checked })}
            />
            <Stepper
              value={agent.returnSpeed}
              onChange={(v) => onChange({ returnSpeed: v })}
              unit="m/s"
              min={1}
              max={20}
              disabled={!agent.useReturnSpeed}
            />
          </div>

          <div className="flex flex-col gap-2 pt-3 border-t border-[#1E212A]">
            <span className="text-[10px] font-mono uppercase tracking-wide text-[#4A4E5C]">Waypoint Tolerance</span>
            <Stepper value={agent.waypointTolerance} onChange={(v) => onChange({ waypointTolerance: v })} unit="m" min={1} max={30} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#4A4E5C]">{label}</span>
      <span className="text-[#D7D9E0]">{value}</span>
    </div>
  );
}