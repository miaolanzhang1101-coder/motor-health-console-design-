'use client';

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  disabled?: boolean;
}

export default function Stepper({ value, onChange, step = 1, min = 0, max = 999, unit, disabled = false }: StepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(clamp(value - step))}
        disabled={disabled}
        className="w-7 h-7 flex items-center justify-center border border-[#1E212A] text-[#7C8090] hover:border-[#2A2E3A] hover:text-[#D7D9E0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        −
      </button>
      <div className="flex-1 text-center text-xs font-mono tabular-nums" style={{ color: disabled ? '#4A4E5C' : '#D7D9E0' }}>
        {value} {unit}
      </div>
      <button
        onClick={() => onChange(clamp(value + step))}
        disabled={disabled}
        className="w-7 h-7 flex items-center justify-center border border-[#1E212A] text-[#7C8090] hover:border-[#2A2E3A] hover:text-[#D7D9E0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        +
      </button>
    </div>
  );
}