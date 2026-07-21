'use client';
import { RobotCell, Job, CELL_STATUS_COLORS, CELL_STATUS_LABELS, JOB_TYPE_LABELS } from '../lib/cells';
import CellStatusPill from './ui/CellStatusPill';

// Panels float over the light-colored facility map, so they use a
// semi-opaque dark chrome with strong border — high contrast against
// paper-beige map, still legible against occasional dark elements.

export function RobotsPanel({
  cells,
  selectedCellId,
  onSelect,
}: {
  cells: RobotCell[];
  selectedCellId: string | null;
  onSelect: (cell: RobotCell) => void;
}) {
  return (
    <div className="w-[280px] bg-[#000000]/95 backdrop-blur-md border border-[#26262F] shadow-lg">
      <div className="px-3 py-2 border-b border-[#26262F] flex items-center justify-between">
        <span className="text-[12px] font-mono font-semibold text-[#FFFFFF]">Robots</span>
        <span className="text-[10px] font-mono text-[#A0A0AB]">{cells.length} connected</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {cells.map((cell) => {
          const isAssistance = cell.status === 'assistance-required';
          const isSelected = selectedCellId === cell.id;
          return (
            <button
              key={cell.id}
              onClick={() => onSelect(cell)}
              aria-label={`${cell.name}, ${cell.location}, ${cell.status}`}
              aria-current={selectedCellId === cell.id ? 'true' : undefined}
              className="w-full grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 border-b border-[#1A1A21] last:border-b-0 hover:bg-[#08080B] transition-colors text-left"
              style={{
                background: isSelected ? '#08080B' : isAssistance ? '#4DB8FF10' : 'transparent',
                borderLeft: isAssistance ? '2px solid #4DB8FF' : isSelected ? '2px solid #4DB8FF' : '2px solid transparent',
              }}
            >
              <div className="min-w-0">
                <div className="text-[12px] font-mono text-[#FFFFFF]">{cell.name}</div>
                <div className="text-[10px] font-mono text-[#A0A0AB] truncate">
                  {cell.currentTask ?? 'Idle'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isAssistance && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4DB8FF] opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#4DB8FF]" />
                  </span>
                )}
                <span
                  className="text-[10px] font-mono tabular-nums"
                  style={{ color: CELL_STATUS_COLORS[cell.status] }}
                >
                  {isAssistance ? 'ASSIST' : CELL_STATUS_LABELS[cell.status]}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function UpcomingMissionsPanel({ jobs, cells }: { jobs: Job[]; cells: RobotCell[] }) {
  const cellNameById = Object.fromEntries(cells.map((c) => [c.id, c.name]));
  const queued = jobs.filter((j) => j.status === 'queued' || j.status === 'running').slice(0, 8);

  return (
    <div className="w-[360px] bg-[#000000]/95 backdrop-blur-md border border-[#26262F] shadow-lg">
      <div className="px-3 py-2 border-b border-[#26262F] flex items-center justify-between">
        <span className="text-[12px] font-mono font-semibold text-[#FFFFFF]">Upcoming Missions</span>
        <span className="text-[10px] font-mono text-[#A0A0AB]">{queued.length}</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {queued.length === 0 ? (
          <div className="p-3 text-[11px] font-mono text-[#8B8B96]">
            No missions queued. Use ⌘K to send one.
          </div>
        ) : queued.map((job) => (
          <div
            key={job.id}
            className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-3 py-2 border-b border-[#1A1A21] last:border-b-0"
          >
            <span className="text-[12px] font-mono text-[#FFFFFF]">{cellNameById[job.cellId] ?? job.cellId}</span>
            <span className="text-[10px] font-mono text-[#A0A0AB]">{JOB_TYPE_LABELS[job.type]}</span>
            <span className="text-[10px] font-mono text-[#8B8B96] tabular-nums">
              {new Date(job.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RobotStatusCard({
  cell,
  onPilot,
  onEstop,
  onOpenConsole,
}: {
  cell: RobotCell | null;
  onPilot: () => void;
  onEstop: () => void;
  onOpenConsole: () => void;
}) {
  if (!cell) return null;

  return (
    <div className="w-[360px] bg-[#000000]/95 backdrop-blur-md border border-[#26262F] shadow-lg">
      <div className="px-3 py-2 border-b border-[#26262F]">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-mono font-semibold text-[#4DB8FF] border-b-2 border-[#4DB8FF] pb-1">
            Robot Status
          </span>
          <span className="text-[12px] font-mono text-[#A0A0AB]">Config</span>
          <span className="text-[12px] font-mono text-[#A0A0AB]">Jobs</span>
          <span className="text-[12px] font-mono text-[#A0A0AB]">Map</span>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-1.5">
        <StatusRow label="Cell" value={cell.name} />
        <StatusRow label="Mode" value={cell.mode} highlight />
        <StatusRow label="Battery" value={`${Math.round(cell.battery)}%`} />
        <StatusRow label="Line" value={cell.location} />
        <StatusRow label="Status" pill={<CellStatusPill status={cell.status} />} />
        <StatusRow label="Task" value={cell.currentTask ?? '—'} />
        <StatusRow label="Utilization" value={`${cell.utilizationPct}%`} />
      </div>

      <div className="flex gap-2 p-3 pt-0">
        <button
          onClick={onOpenConsole}
          aria-label={`Open console for ${cell.name}`}
          className="flex-1 text-[11px] font-mono px-3 h-[30px] rounded-[5px] border border-[#4DB8FF] bg-[#4DB8FF]/10 text-[#4DB8FF] hover:bg-[#4DB8FF]/20 transition-colors"
        >
          Console
        </button>
        <button
          onClick={onPilot}
          aria-label={`Pilot ${cell.name}`}
          className="flex-1 text-[11px] font-mono px-3 h-[30px] rounded-[5px] border border-[#4DB8FF] bg-[#4DB8FF]/10 text-[#4DB8FF] hover:bg-[#4DB8FF]/20 transition-colors"
        >
          Pilot
        </button>
        <button
          onClick={onEstop}
          aria-label={`Emergency stop ${cell.name}`}
          className="flex-1 text-[11px] font-mono px-3 h-[30px] rounded-[5px] border border-[#FF5A5A] bg-[#FF5A5A]/10 text-[#FF5A5A] hover:bg-[#FF5A5A]/20 transition-colors"
        >
          E-Stop
        </button>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  pill,
  highlight,
}: {
  label: string;
  value?: string;
  pill?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-[11px] font-mono">
      <span className="text-[#A0A0AB]">{label}</span>
      {pill ? pill : (
        <span
          className="tabular-nums capitalize"
          style={{ color: highlight ? '#4DB8FF' : '#FFFFFF' }}
        >
          {value}
        </span>
      )}
    </div>
  );
}