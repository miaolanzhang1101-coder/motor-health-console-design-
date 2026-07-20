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
    <div className="w-[280px] bg-[#08090C]/95 backdrop-blur-md border border-[#2A303B] shadow-lg">
      <div className="px-3 py-2 border-b border-[#2A303B] flex items-center justify-between">
        <span className="text-[12px] font-mono font-semibold text-[#E5E7EB]">Robots</span>
        <span className="text-[10px] font-mono text-[#9CA3AF]">{cells.length} connected</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {cells.map((cell) => {
          const isAssistance = cell.status === 'assistance-required';
          const isSelected = selectedCellId === cell.id;
          return (
            <button
              key={cell.id}
              onClick={() => onSelect(cell)}
              className="w-full grid grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 border-b border-[#1E232B] last:border-b-0 hover:bg-[#111318] transition-colors text-left"
              style={{
                background: isSelected ? '#111318' : isAssistance ? '#F59E0B10' : 'transparent',
                borderLeft: isAssistance ? '2px solid #F59E0B' : isSelected ? '2px solid #60A5FA' : '2px solid transparent',
              }}
            >
              <div className="min-w-0">
                <div className="text-[12px] font-mono text-[#E5E7EB]">{cell.name}</div>
                <div className="text-[10px] font-mono text-[#9CA3AF] truncate">
                  {cell.currentTask ?? 'Idle'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isAssistance && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F59E0B] opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
                  </span>
                )}
                <span
                  className="text-[10px] font-mono uppercase tabular-nums font-semibold"
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
    <div className="w-[360px] bg-[#08090C]/95 backdrop-blur-md border border-[#2A303B] shadow-lg">
      <div className="px-3 py-2 border-b border-[#2A303B] flex items-center justify-between">
        <span className="text-[12px] font-mono font-semibold text-[#E5E7EB]">Upcoming Missions</span>
        <span className="text-[10px] font-mono text-[#9CA3AF]">{queued.length}</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {queued.length === 0 ? (
          <div className="p-3 text-[11px] font-mono text-[#6B7280]">
            No missions queued. Use ⌘K to send one.
          </div>
        ) : queued.map((job) => (
          <div
            key={job.id}
            className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-3 py-2 border-b border-[#1E232B] last:border-b-0"
          >
            <span className="text-[12px] font-mono text-[#E5E7EB]">{cellNameById[job.cellId] ?? job.cellId}</span>
            <span className="text-[10px] font-mono text-[#9CA3AF]">{JOB_TYPE_LABELS[job.type]}</span>
            <span className="text-[10px] font-mono text-[#6B7280] tabular-nums">
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
    <div className="w-[360px] bg-[#08090C]/95 backdrop-blur-md border border-[#2A303B] shadow-lg">
      <div className="px-3 py-2 border-b border-[#2A303B]">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-mono font-semibold text-[#60A5FA] border-b-2 border-[#60A5FA] pb-1">
            Robot Status
          </span>
          <span className="text-[12px] font-mono text-[#9CA3AF]">Config</span>
          <span className="text-[12px] font-mono text-[#9CA3AF]">Jobs</span>
          <span className="text-[12px] font-mono text-[#9CA3AF]">Map</span>
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
          className="flex-1 text-[11px] font-mono uppercase px-3 py-2 border border-[#60A5FA] bg-[#60A5FA]/10 text-[#60A5FA] hover:bg-[#60A5FA]/20 transition-colors"
        >
          Console
        </button>
        <button
          onClick={onPilot}
          className="flex-1 text-[11px] font-mono uppercase px-3 py-2 border border-[#60A5FA] bg-[#60A5FA]/10 text-[#60A5FA] hover:bg-[#60A5FA]/20 transition-colors"
        >
          Pilot
        </button>
        <button
          onClick={onEstop}
          className="flex-1 text-[11px] font-mono uppercase px-3 py-2 border border-[#EF4444] bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition-colors"
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
      <span className="text-[#9CA3AF]">{label}</span>
      {pill ? pill : (
        <span
          className="tabular-nums capitalize"
          style={{ color: highlight ? '#60A5FA' : '#E5E7EB' }}
        >
          {value}
        </span>
      )}
    </div>
  );
}