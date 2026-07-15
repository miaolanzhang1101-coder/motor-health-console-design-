'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Agent, AgentStatus, generateInitialAgents, tickAgent } from '../lib/agentStream';
import AgentControlPanel from './AgentControlPanel';

// Leaflet touches `window` at import time, which crashes Next.js's
// server-side render. Loading it only on the client sidesteps that.
const MapView = dynamic(() => import('./FleetMapView'), { ssr: false });

const STATUS_COLORS: Record<AgentStatus, string> = {
  patrolling: '#475569',
  'en-route': '#3B82F6',
  returning: '#818CF8',
  charging: '#22D3EE',
};

export default function FleetMapDemo() {
  const [agents, setAgents] = useState<Agent[]>(() => generateInitialAgents());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Simulated real-time stream — this interval stands in for a WebSocket
  // onmessage handler. A real connection would call the same setAgents
  // update from a message event instead of a timer; nothing downstream
  // needs to change.
  useEffect(() => {
    const id = setInterval(() => {
      setAgents((prev) => prev.map(tickAgent));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const selected = agents.find((a) => a.id === selectedId) ?? null;

  const setWaypoint = (lat: number, lng: number) => {
    if (!selectedId) return;
    setAgents((prev) =>
      prev.map((a) => (a.id === selectedId ? { ...a, target: [lat, lng], status: 'en-route' } : a))
    );
  };

  const updateAgentParams = (patch: Partial<Agent>) => {
    if (!selectedId) return;
    setAgents((prev) => prev.map((a) => (a.id === selectedId ? { ...a, ...patch } : a)));
  };

  return (
    <div className="flex" style={{ height: 'calc(100vh - 40px)' }}>
      <div className="w-80 shrink-0 border-r border-[#1E212A] bg-[#0D0F13] overflow-y-auto flex flex-col">
        <div className="px-4 py-3 border-b border-[#1E212A] flex items-center justify-between">
          <span className="text-xs font-mono font-semibold text-[#D7D9E0]">Perimeter Patrol</span>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22D3EE] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22D3EE]" />
            </span>
            <span className="text-[9px] font-mono text-[#22D3EE] uppercase">Live</span>
          </span>
        </div>

        <div className="px-4 py-2 text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C]">
          Agents ({agents.length})
        </div>
        <div className="px-2 pb-3 flex flex-col gap-1">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className="text-left px-2 py-2 border transition-colors"
              style={{
                borderColor: selectedId === a.id ? '#3B82F6' : '#1E212A',
                background: selectedId === a.id ? '#111318' : 'transparent',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#D7D9E0]">{a.name}</span>
                <span className="text-[9px] font-mono uppercase" style={{ color: STATUS_COLORS[a.status] }}>
                  {a.status}
                </span>
              </div>
              <div className="text-[9px] font-mono text-[#4A4E5C] mt-1">
                {a.kind} · battery {Math.round(a.battery)}%
              </div>
              <div className="w-full h-1 bg-[#1E212A] mt-1">
                <div
                  className="h-1"
                  style={{ width: `${a.battery}%`, background: a.battery < 20 ? '#22D3EE' : '#475569' }}
                />
              </div>
            </button>
          ))}
        </div>

        <div className="px-4 py-2 text-[10px] font-mono text-[#4A4E5C] border-t border-[#1E212A]">
          {selected ? `Click the map to send ${selected.name} to a new waypoint.` : 'Select an agent to assign a waypoint.'}
        </div>
      </div>

      <div className="flex-1 relative">
        <MapView agents={agents} selectedId={selectedId} onMapClick={setWaypoint} statusColors={STATUS_COLORS} />
        {selected && (
          <AgentControlPanel agent={selected} onChange={updateAgentParams} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  );
}