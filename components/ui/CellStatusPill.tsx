'use client';
import { CellStatus, CELL_STATUS_COLORS, CELL_STATUS_LABELS } from '../../lib/cells';

interface CellStatusPillProps {
  status: CellStatus;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export default function CellStatusPill({ status, size = 'sm', showDot = true }: CellStatusPillProps) {
  const color = CELL_STATUS_COLORS[status];
  const isLive = status === 'running';
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${textSize} font-mono uppercase px-1.5 py-0.5`}
      style={{ color, borderLeft: `2px solid ${color}` }}
    >
      {showDot && (
        <span className="relative flex h-1.5 w-1.5">
          {isLive && (
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: color }}
            />
          )}
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: color }}
          />
        </span>
      )}
      {CELL_STATUS_LABELS[status]}
    </span>
  );
}