'use client';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FacilityMap from './FacilityMap';
import { RobotsPanel, UpcomingMissionsPanel, RobotStatusCard } from './FacilityMapOverlays';
import JobComposer from './JobComposer';
import { Motor } from '../lib/types';
import { RobotCell, Job, cellFromMotor, CELL_STATUS_COLORS } from '../lib/cells';

interface FleetDashboardProps {
  motors: Motor[];
  onOpenCell: (cell: RobotCell) => void;
  jobs: Job[];
  onSendJob: (job: Omit<Job, 'id' | 'status' | 'createdAt'>) => void;
  onCancelJob: (jobId: string) => void;
}

export default function FleetDashboard({
  motors,
  onOpenCell,
  jobs,
  onSendJob,
}: FleetDashboardProps) {
  const cells = useMemo(() => motors.map((m, i) => cellFromMotor(m, i)), [motors]);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  const selectedCell = cells.find((c) => c.id === selectedCellId) ?? null;

  const summary = useMemo(() => {
    const total = cells.length;
    const running = cells.filter((c) => c.status === 'running').length;
    const assistance = cells.filter((c) => c.status === 'assistance-required').length;
    const attention = cells.filter((c) => c.status === 'error' || c.status === 'assistance-required').length;
    const avgUtil = Math.round(cells.reduce((s, c) => s + c.utilizationPct, 0) / (total || 1));
    return { total, running, assistance, attention, avgUtil };
  }, [cells]);

  const assistanceCell = cells.find((c) => c.status === 'assistance-required');

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Alert banner — only when a cell needs assistance (Step 3 of the workflow) */}
      <AnimatePresence>
        {assistanceCell && (
          <motion.button
            key="alert-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => onOpenCell(assistanceCell)}
            className="relative w-full overflow-hidden text-left group"
            style={{ background: 'rgba(245,158,11,0.07)', borderBottom: '1px solid rgba(245,158,11,0.45)' }}
          >
            {/* scanline sweep — reads as an active alarm rather than a static banner */}
            <motion.div
              className="absolute inset-y-0 w-40 pointer-events-none"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.10), transparent)' }}
              animate={{ x: ['-10rem', '100vw'] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
            />

            <div className="relative px-5 py-3 flex items-center gap-4">
              {/* hazard glyph */}
              <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#F59E0B]" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#F59E0B]" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-[#F59E0B]" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#F59E0B]" />
                <motion.span
                  className="text-lg text-[#F59E0B] leading-none"
                  animate={{ opacity: [1, 0.25, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden="true"
                >
                  ⚠
                </motion.span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono uppercase tracking-[0.28em] text-[#F59E0B]">
                    Fault
                  </span>
                  <span className="h-px flex-1 max-w-[60px] bg-[#F59E0B]/40" />
                  <span className="text-[13px] font-mono uppercase tracking-[0.1em] text-[#FCD34D]">
                    {assistanceCell.name} · assistance required
                  </span>
                </div>
                <div className="text-[10px] font-mono text-neutral-500 mt-1 tracking-[0.04em]">
                  {assistanceCell.location} · misaligned workpiece · grasp confidence 0.31 below floor 0.75
                </div>
              </div>

              {/* live counters */}
              <div className="hidden lg:flex items-center gap-5 px-5 border-l border-[#F59E0B]/25">
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-neutral-600">Halted</div>
                  <div className="text-sm font-mono tabular-nums text-[#F59E0B] leading-tight">00:42</div>
                </div>
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-neutral-600">Skew</div>
                  <div className="text-sm font-mono tabular-nums text-[#F59E0B] leading-tight">15°</div>
                </div>
              </div>

              <span
                className="relative text-[10px] font-mono uppercase tracking-[0.18em] text-[#FCD34D] px-4 py-2 shrink-0 transition-colors"
                style={{ border: '1px solid #F59E0B', background: 'rgba(245,158,11,0.14)' }}
              >
                Open console →
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Summary strip */}
      <div className="grid grid-cols-5 gap-px bg-[#1E232B] border-b border-[#1E232B]">
        <SummaryTile label="Cells" value={summary.total} />
        <SummaryTile label="Optimal" value={summary.running} color={CELL_STATUS_COLORS.running} />
        <SummaryTile
          label="Assistance"
          value={summary.assistance}
          color={CELL_STATUS_COLORS['assistance-required']}
          pulse={summary.assistance > 0}
        />
        <SummaryTile label="Attention" value={summary.attention} color={CELL_STATUS_COLORS.error} />
        <SummaryTile label="Avg Utilization" value={`${summary.avgUtil}%`} />
      </div>

      {/* Map + floating overlays */}
      <div className="flex-1 relative min-h-0">
        <FacilityMap
          cells={cells}
          highlightCellId={selectedCellId ?? undefined}
          onCellClick={(c) => setSelectedCellId(c.id)}
          dimNonCritical={summary.assistance > 0}
        />

        {/* Upper-left: Robots panel — positioned below the facility label */}
        <div className="absolute top-16 left-4">
          <RobotsPanel cells={cells} selectedCellId={selectedCellId} onSelect={(c) => setSelectedCellId(c.id)} />
        </div>

        {/* Upper-right: Upcoming Missions */}
        <div className="absolute top-4 right-4">
          <UpcomingMissionsPanel jobs={jobs} cells={cells} />
        </div>

        {/* Lower-right: Robot Status card + Job Composer */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-3">
          <RobotStatusCard
            cell={selectedCell}
            onPilot={() => selectedCell && onOpenCell(selectedCell)}
            onOpenConsole={() => selectedCell && onOpenCell(selectedCell)}
            onEstop={() => {}}
          />
          <div className="w-[360px]">
            <JobComposer cells={cells} onSend={onSendJob} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  color,
  pulse,
}: {
  label: string;
  value: string | number;
  color?: string;
  pulse?: boolean;
}) {
  return (
    <div className="bg-[#0A0C0F] px-3 py-2 flex items-center justify-between">
      <div>
        <div className="text-[9px] font-mono uppercase tracking-wide text-[#6B7280]">{label}</div>
        <div className="text-lg font-mono font-semibold tabular-nums mt-0.5" style={{ color: color ?? '#E5E7EB' }}>
          {value}
        </div>
      </div>
      {pulse && color && (
        <motion.span
          className="w-2 h-2 rounded-full"
          style={{ background: color }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
}