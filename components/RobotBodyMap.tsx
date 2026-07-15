'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { statusToSeverity, SEVERITY_COLORS } from '../lib/severity';
import { getMotorTypeLabel } from '../lib/thresholdTree';
import { Motor } from '../lib/types';

interface Slot {
  label: string;
  x: number;
  y: number;
  footX: number;
  footY: number;
}

const SLOTS: Slot[] = [
  { label: 'Front-Left Actuator', x: 140, y: 150, footX: 125, footY: 228 },
  { label: 'Front-Right Actuator', x: 168, y: 158, footX: 155, footY: 232 },
  { label: 'Rear-Left Actuator', x: 218, y: 150, footX: 235, footY: 228 },
  { label: 'Rear-Right Actuator', x: 246, y: 158, footX: 262, footY: 232 },
  { label: 'Torso Actuator', x: 193, y: 100, footX: 193, footY: 100 },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Fan Motor': '#A78BFA',
  'Pump Motor': '#FB923C',
  Unclassified: '#3B82F6',
};
const CATEGORY_TO_NODE: Record<string, string> = {
  'Fan Motor': 'fan',
  'Pump Motor': 'pump',
  Unclassified: 'global',
};

interface RobotBodyMapProps {
  motors: Motor[];
  selectedMotor: Motor | null;
  onSelectMotor: (motor: Motor) => void;
  colorMode?: 'severity' | 'category';
  onSelectCategory?: (nodeId: string) => void;
}

export default function RobotBodyMap({
  motors,
  selectedMotor,
  onSelectMotor,
  colorMode = 'severity',
  onSelectCategory,
}: RobotBodyMapProps) {
  const reduceMotion = useReducedMotion();
  const shown = motors.slice(0, SLOTS.length);
  const overflow = motors.length - shown.length;
  const presentCategories = Array.from(new Set(shown.map((m) => getMotorTypeLabel(m.file))));

  return (
    <div className="border border-[#1E212A] bg-[#111318] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C]">
          {colorMode === 'category' ? 'Fleet by Category' : 'Fleet as Actuators'}
        </span>
        {overflow > 0 && (
          <span className="text-[9px] font-mono text-[#4A4E5C]">+{overflow} more — switch to table view</span>
        )}
      </div>

      <svg viewBox="0 0 380 260" className="w-full h-auto">
        <line x1={20} y1={235} x2={360} y2={235} stroke="#1E212A" strokeWidth={1} />
        <rect x={125} y={75} width={140} height={60} rx={14} fill="#161A22" stroke="#2A2E3A" strokeWidth={1.5} />
        <rect x={125} y={75} width={140} height={14} rx={7} fill="#1C212C" />
        <rect x={258} y={88} width={30} height={26} rx={6} fill="#161A22" stroke="#2A2E3A" strokeWidth={1.5} />
        <circle cx={278} cy={101} r={3} fill="#3B82F6" />

        {SLOTS.slice(0, 4).map((s, i) => {
          const kneeX = s.x + (s.x < 190 ? -6 : 6);
          const kneeY = (s.y + s.footY) / 2 + 10;
          return (
            <g key={i}>
              <line x1={s.x} y1={s.y} x2={kneeX} y2={kneeY} stroke="#3D4552" strokeWidth={5} strokeLinecap="round" />
              <line x1={kneeX} y1={kneeY} x2={s.footX} y2={s.footY} stroke="#2A2E3A" strokeWidth={5} strokeLinecap="round" />
              <circle cx={kneeX} cy={kneeY} r={3} fill="#1C212C" stroke="#3D4552" strokeWidth={1} />
            </g>
          );
        })}

        {shown.map((motor, i) => {
          const slot = SLOTS[i];
          const severity = statusToSeverity(motor.status);
          const category = getMotorTypeLabel(motor.file);
          const color = colorMode === 'category' ? CATEGORY_COLORS[category] : SEVERITY_COLORS[severity];
          const selected = selectedMotor?.file === motor.file;
          const isCritical = colorMode === 'severity' && severity === 'critical';
          const isHealthy = colorMode === 'severity' && severity === 'healthy';

          return (
            <g key={motor.file} onClick={() => onSelectMotor(motor)} className="cursor-pointer">
              {isCritical && !reduceMotion && (
                <motion.circle
                  cx={slot.x} cy={slot.y}
                  animate={{ r: [8, 16, 8], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  fill={color}
                />
              )}
              <circle cx={slot.x} cy={slot.y} r={selected ? 10 : 8} fill="#0A0B0D" stroke={color} strokeWidth={selected ? 3 : 2} />
              <circle cx={slot.x} cy={slot.y} r={3} fill={color} />

              {isHealthy && (
                <g transform={`translate(${slot.x + 9}, ${slot.y - 13})`}>
                  <circle r={6} fill="#475569" />
                  <path d="M -2.5 0 L -0.5 2 L 3 -2.5" stroke="#0A0B0D" strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              )}

              <text x={slot.x} y={slot.y - 16} textAnchor="middle" fontSize={8} fontFamily="monospace" fill="#7C8090">
                {motor.name}
              </text>
            </g>
          );
        })}
      </svg>

      {colorMode === 'severity' ? (
        <div className="flex gap-3 mt-2 flex-wrap justify-center">
          {(['healthy', 'watch', 'critical'] as const).map((lvl) => (
            <div key={lvl} className="flex items-center gap-1.5 text-[9px] font-mono text-[#7C8090] capitalize">
              <span className="w-2 h-2 rounded-full" style={{ background: SEVERITY_COLORS[lvl] }} />
              {lvl}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 mt-2 flex-wrap justify-center">
          {presentCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory?.(CATEGORY_TO_NODE[cat])}
              className="flex items-center gap-1.5 text-[9px] font-mono text-[#7C8090] hover:text-[#D7D9E0] transition-colors"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat] }} />
              {cat} — edit default
            </button>
          ))}
        </div>
      )}
    </div>
  );
}