'use client';
import { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * HUD primitives — the visual language of a flight-controls console.
 * Hairline borders, corner brackets instead of solid boxes, dense
 * uppercase monospace micro-labels, tick rulers. Nothing is rounded;
 * everything is squared and technical.
 */

export type HudIntent = 'neutral' | 'safe' | 'warn' | 'danger' | 'accent';

export const HUD_COLOR: Record<HudIntent, string> = {
  neutral: '#4B5563',
  safe: '#10B981',
  warn: '#F59E0B',
  danger: '#EF4444',
  accent: '#60A5FA',
};

/**
 * Corner brackets — four L-shaped marks at the corners of a region.
 * This is the signature of the aesthetic: the frame is implied by its
 * corners rather than drawn as a full rectangle.
 */
export function Brackets({
  intent = 'neutral',
  size = 10,
  weight = 1,
  inset = 0,
}: {
  intent?: HudIntent;
  size?: number;
  weight?: number;
  inset?: number;
}) {
  const c = HUD_COLOR[intent];
  const style = { borderColor: c, borderWidth: weight };
  return (
    <div className="pointer-events-none absolute inset-0" style={{ padding: inset }} aria-hidden="true">
      <div className="absolute top-0 left-0 border-t border-l" style={{ ...style, width: size, height: size }} />
      <div className="absolute top-0 right-0 border-t border-r" style={{ ...style, width: size, height: size }} />
      <div className="absolute bottom-0 left-0 border-b border-l" style={{ ...style, width: size, height: size }} />
      <div className="absolute bottom-0 right-0 border-b border-r" style={{ ...style, width: size, height: size }} />
    </div>
  );
}

/**
 * A framed panel. Hairline border plus corner brackets, with an optional
 * label that sits on the top border line like a schematic callout.
 */
export function HudPanel({
  label,
  right,
  intent = 'neutral',
  children,
  className = '',
  dense = false,
}: {
  label?: string;
  right?: ReactNode;
  intent?: HudIntent;
  children?: ReactNode;
  className?: string;
  dense?: boolean;
}) {
  const c = HUD_COLOR[intent];
  return (
    <div
      className={`relative bg-[#0A0C0F]/60 ${className}`}
      style={{ border: `1px solid ${intent === 'neutral' ? '#1E232B' : `${c}44`}` }}
    >
      <Brackets intent={intent} size={8} />
      {label && (
        <div
          className="flex items-center justify-between px-3 py-1.5 border-b"
          style={{ borderColor: intent === 'neutral' ? '#1E232B' : `${c}33` }}
        >
          <div className="flex items-center gap-2">
            <span className="inline-block w-1 h-1" style={{ background: c }} />
            <span
              className="text-[9px] font-mono uppercase tracking-[0.18em]"
              style={{ color: intent === 'neutral' ? '#6B7280' : c }}
            >
              {label}
            </span>
          </div>
          {right && <div className="text-[9px] font-mono text-neutral-600 tabular-nums">{right}</div>}
        </div>
      )}
      <div className={dense ? '' : 'p-3'}>{children}</div>
    </div>
  );
}

/**
 * Horizontal tick ruler — pure ornament that reads as instrumentation.
 * Long ticks every 5th mark.
 */
export function TickRuler({ count = 40, intent = 'neutral' }: { count?: number; intent?: HudIntent }) {
  const c = HUD_COLOR[intent];
  return (
    <div className="flex items-end gap-[3px] h-2 overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 1,
            height: i % 5 === 0 ? 8 : 4,
            background: c,
            opacity: i % 5 === 0 ? 0.5 : 0.25,
          }}
        />
      ))}
    </div>
  );
}

/**
 * A labelled numeric readout. Monospace, tabular, with the unit
 * de-emphasised so the number itself carries the weight.
 */
export function Readout({
  label,
  value,
  unit,
  intent = 'neutral',
  size = 'md',
}: {
  label: string;
  value: string | number;
  unit?: string;
  intent?: HudIntent;
  size?: 'sm' | 'md' | 'lg';
}) {
  const c = HUD_COLOR[intent];
  const valueSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-xs' : 'text-base';
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-neutral-600">{label}</div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span
          className={`${valueSize} font-mono tabular-nums leading-none`}
          style={{ color: intent === 'neutral' ? '#E5E7EB' : c }}
        >
          {value}
        </span>
        {unit && <span className="text-[10px] font-mono text-neutral-600">{unit}</span>}
      </div>
    </div>
  );
}

/**
 * Status chip — a small square swatch plus uppercase label, no pill
 * shape. Optionally pulses for live/alert states.
 */
export function HudChip({
  label,
  intent = 'neutral',
  pulse = false,
}: {
  label: string;
  intent?: HudIntent;
  pulse?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const c = HUD_COLOR[intent];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.16em]"
      style={{ border: `1px solid ${c}55`, color: c, background: `${c}0D` }}
    >
      {pulse && !reduceMotion ? (
        <motion.span
          className="inline-block w-1.5 h-1.5"
          style={{ background: c }}
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <span className="inline-block w-1.5 h-1.5" style={{ background: c }} />
      )}
      {label}
    </span>
  );
}

/**
 * Horizontal bar meter with a hairline track. Used for load, battery,
 * joint travel — anything with a 0..1 fill.
 */
export function BarMeter({
  value,
  intent = 'accent',
  height = 2,
}: {
  value: number;
  intent?: HudIntent;
  height?: number;
}) {
  const c = HUD_COLOR[intent];
  return (
    <div className="w-full" style={{ height, background: '#1E232B' }} aria-hidden="true">
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value * 100))}%`,
          height: '100%',
          background: c,
          transition: 'width 300ms ease',
        }}
      />
    </div>
  );
}

/**
 * Section divider with a label — mimics the horizontal rules that
 * partition a mission-control screen.
 */
export function HudDivider({ label, intent = 'neutral' }: { label?: string; intent?: HudIntent }) {
  const c = HUD_COLOR[intent];
  return (
    <div className="flex items-center gap-2 py-1" aria-hidden="true">
      <span className="inline-block w-1 h-1" style={{ background: c }} />
      {label && (
        <span className="text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: c, opacity: 0.8 }}>
          {label}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: '#1E232B' }} />
    </div>
  );
}