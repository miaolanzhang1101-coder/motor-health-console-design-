'use client';
import { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Interface primitives.
 *
 * Black ground, white data, purple for anything the operator can act on
 * or that demands attention, red only for a genuine fault. Every edge is
 * square. No ornament: if a mark is on screen it is carrying information.
 */

export type Tone = 'neutral' | 'white' | 'blue' | 'red';

export const TONE: Record<Tone, string> = {
  neutral: '#8B8B96',
  white:   '#FFFFFF',
  blue:  '#4DB8FF',
  red:     '#FF5A5A',
};

// Back-compat aliases for existing call sites
export const HUD_COLOR = {
  neutral: TONE.neutral,
  safe: TONE.white,
  warn: TONE.blue,
  danger: TONE.red,
  accent: TONE.blue,
};
export function Brackets() { return null; }

/* ------------------------------------------------------------------ */

export function Panel({
  label, right, tone = 'neutral', children, className = '', padded = true, accentEdge = false,
}: {
  label?: string; right?: ReactNode; tone?: Tone; children?: ReactNode;
  className?: string; padded?: boolean; accentEdge?: boolean;
}) {
  const c = TONE[tone];
  return (
    <div
      className={`relative bg-[#08080B] border overflow-hidden ${className}`}
      style={{ borderColor: accentEdge ? `${c}44` : '#1A1A21' }}
    >
      {accentEdge && <div className="absolute inset-x-0 top-0 h-px" style={{ background: c }} />}
      {label && (
        <div className="flex items-center justify-between px-3 h-[28px] border-b border-[#131318]">
          <span className="text-[11px] text-[#A0A0AB]">{label}</span>
          {right && <span className="text-[10px] font-mono text-[#757580]">{right}</span>}
        </div>
      )}
      <div className={padded ? 'p-3' : ''}>{children}</div>
    </div>
  );
}

export function Field({
  label, value, unit, tone = 'neutral', size = 'md',
}: {
  label: string; value: string | number; unit?: string; tone?: Tone;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizes = { sm: 'text-[11px]', md: 'text-[13px]', lg: 'text-[17px]', xl: 'text-[26px]' };
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-[#8B8B96] leading-none">{label}</div>
      <div className="flex items-baseline gap-1 mt-1.5">
        <span
          className={`${sizes[size]} font-mono leading-none truncate`}
          style={{ color: tone === 'neutral' ? '#FFFFFF' : TONE[tone] }}
        >
          {value}
        </span>
        {unit && <span className="text-[10px] text-[#757580] shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

export function Chip({ label, tone = 'neutral', pulse = false }: {
  label: string; tone?: Tone; pulse?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const c = TONE[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 h-[20px] px-2 text-[10px] whitespace-nowrap border"
      style={{ background: `${c}12`, color: c, borderColor: `${c}33` }}
    >
      {pulse && !reduceMotion ? (
        <motion.span className="w-1 h-1 shrink-0" style={{ background: c }}
          animate={{ opacity: [1, 0.15, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
      ) : (
        <span className="w-1 h-1 shrink-0" style={{ background: c }} />
      )}
      {label}
    </span>
  );
}

export function Meter({ value, tone = 'blue', height = 2 }: {
  value: number; tone?: Tone; height?: number;
}) {
  return (
    <div className="w-full" style={{ height, background: '#1A1A21' }} aria-hidden="true">
      <div style={{
        width: `${Math.max(0, Math.min(100, value * 100))}%`,
        height: '100%', background: TONE[tone],
        transition: 'width 280ms linear',
      }} />
    </div>
  );
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="h-px bg-[#131318]" aria-hidden="true" />;
  return (
    <div className="flex items-center gap-2.5 py-1" aria-hidden="true">
      <span className="text-[10px] text-[#8B8B96] whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-[#131318]" />
    </div>
  );
}

export function Button({
  children, onClick, tone = 'blue', variant = 'solid', disabled, full, size = 'md',
}: {
  children: ReactNode; onClick?: () => void; tone?: Tone;
  variant?: 'solid' | 'outline' | 'ghost'; disabled?: boolean; full?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const c = TONE[tone];
  const heights = { sm: 'h-[26px] text-[11px] px-3', md: 'h-[32px] text-[12px] px-4', lg: 'h-[40px] text-[13px] px-5' };
  const styles =
    variant === 'solid'
      ? { background: `${c}1A`, border: `1px solid ${c}`, color: c }
      : variant === 'outline'
      ? { background: 'transparent', border: '1px solid #26262F', color: '#A0A0AB' }
      : { background: 'transparent', border: '1px solid transparent', color: '#8B8B96' };
  return (
    <button
      onClick={onClick} disabled={disabled} style={styles}
      className={`${heights[size]} ${full ? 'w-full' : ''} inline-flex items-center justify-center gap-2
        transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-150`}
    >
      {children}
    </button>
  );
}

export function Sparkline({ data, tone = 'blue', height = 28 }: {
  data: number[]; tone?: Tone; height?: number;
}) {
  if (data.length < 2) return <div style={{ height }} />;
  const max = Math.max(...data, 0.0001);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / span) * 100}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} className="w-full" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={TONE[tone]} strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}