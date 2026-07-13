'use client';
import { useRef, useCallback } from 'react';
import Input from './Input';

interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}

export default function RangeSlider({ min, max, value, onChange }: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'lo' | 'hi' | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const pctOf = (v: number) => ((v - min) / (max - min || 1)) * 100;

  const handleMove = useCallback(
    (e: PointerEvent) => {
      const track = trackRef.current;
      const handle = draggingRef.current;
      if (!track || !handle) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
      const v = Math.round(min + pct * (max - min));
      const [lo, hi] = valueRef.current;
      if (handle === 'lo') onChange([Math.min(v, hi - 1), hi]);
      else onChange([lo, Math.max(v, lo + 1)]);
    },
    [min, max, onChange]
  );

  const stop = useCallback(() => {
    draggingRef.current = null;
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', stop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleMove]);

  const start = (handle: 'lo' | 'hi') => (e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = handle;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stop);
  };

  const [lo, hi] = value;

  return (
    <div className="flex flex-col gap-3">
      <div ref={trackRef} className="relative h-1 bg-[#1E212A] rounded-full mx-2 touch-none">
        <div
          className="absolute h-1 bg-[#3B82F6] rounded-full"
          style={{ left: `${pctOf(lo)}%`, width: `${pctOf(hi) - pctOf(lo)}%` }}
        />
        <div
          onPointerDown={start('lo')}
          className="absolute w-3.5 h-3.5 rounded-full bg-[#0A0B0D] border-2 border-[#3B82F6] cursor-grab active:cursor-grabbing"
          style={{ left: `${pctOf(lo)}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
        />
        <div
          onPointerDown={start('hi')}
          className="absolute w-3.5 h-3.5 rounded-full bg-[#0A0B0D] border-2 border-[#3B82F6] cursor-grab active:cursor-grabbing"
          style={{ left: `${pctOf(hi)}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <div className="flex justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-[#4A4E5C] uppercase">Min window</span>
          <div className="w-16">
            <Input type="number" value={lo} onChange={(v) => onChange([Math.min(Number(v), hi - 1), hi])} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-[#4A4E5C] uppercase">Max window</span>
          <div className="w-16">
            <Input type="number" value={hi} onChange={(v) => onChange([lo, Math.max(Number(v), lo + 1)])} />
          </div>
        </div>
      </div>
    </div>
  );
}