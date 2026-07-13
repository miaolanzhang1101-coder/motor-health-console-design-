'use client';

interface InputProps {
  value: number | string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  disabled?: boolean;
  color?: string;
  placeholder?: string;
}

export default function Input({ value, onChange, type = 'text', disabled = false, color, placeholder }: InputProps) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#0D0F13] border border-[#1E212A] px-2 py-1.5 text-sm font-mono tabular-nums disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-[#3B82F6] transition-colors"
      style={{ color: color ?? '#D7D9E0' }}
    />
  );
}