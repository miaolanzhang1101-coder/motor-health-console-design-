'use client';
import { RobotCell, CELL_STATUS_COLORS } from '../lib/cells';

interface FacilityMiniMapProps {
  cells: RobotCell[];
  highlightCellId?: string;
  onCellClick?: (cell: RobotCell) => void;
  compact?: boolean;
}

/**
 * A schematic top-down view of the facility floor with each cell shown
 * at its assigned position. Deliberately abstract — bare production
 * lines and workspace zones rather than a photorealistic floor plan —
 * so the interface says clearly "this is a schema, not the building."
 */
export default function FacilityMiniMap({ cells, highlightCellId, onCellClick, compact = false }: FacilityMiniMapProps) {
  const height = compact ? 120 : 220;

  return (
    <div className="relative w-full border border-[#1E212A] bg-[#08090A]" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full absolute inset-0">
        {/* production line zones */}
        <rect x="10" y="10" width="80" height="26" fill="none" stroke="#15171D" strokeWidth="0.3" strokeDasharray="1 1" />
        <rect x="10" y="42" width="80" height="26" fill="none" stroke="#15171D" strokeWidth="0.3" strokeDasharray="1 1" />
        <rect x="10" y="72" width="80" height="20" fill="none" stroke="#15171D" strokeWidth="0.3" strokeDasharray="1 1" />

        {/* zone labels */}
        <text x="11" y="14" fontSize="2" fontFamily="monospace" fill="#2A2E3A">LINE A</text>
        <text x="11" y="46" fontSize="2" fontFamily="monospace" fill="#2A2E3A">LINE B</text>
        <text x="11" y="76" fontSize="2" fontFamily="monospace" fill="#2A2E3A">LINE C</text>

        {/* cells */}
        {cells.map((cell) => {
          const isHighlight = cell.id === highlightCellId;
          const color = CELL_STATUS_COLORS[cell.status];
          return (
            <g
              key={cell.id}
              onClick={() => onCellClick?.(cell)}
              style={{ cursor: onCellClick ? 'pointer' : 'default' }}
            >
              {isHighlight && (
                <circle
                  cx={cell.positionOnMap.x}
                  cy={cell.positionOnMap.y}
                  r={4}
                  fill={color}
                  fillOpacity={0.2}
                />
              )}
              <circle
                cx={cell.positionOnMap.x}
                cy={cell.positionOnMap.y}
                r={isHighlight ? 2 : 1.5}
                fill={color}
                stroke={isHighlight ? '#D7D9E0' : 'none'}
                strokeWidth={0.4}
              />
              {!compact && (
                <text
                  x={cell.positionOnMap.x + 3}
                  y={cell.positionOnMap.y + 1}
                  fontSize="2.4"
                  fontFamily="monospace"
                  fill={isHighlight ? '#D7D9E0' : '#4A4E5C'}
                >
                  {cell.name.replace('Cell ', '')}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}