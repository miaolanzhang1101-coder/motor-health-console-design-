'use client';
import { toDeviationIndex } from '../lib/normalize';
import { Motor } from '../lib/types';

interface MultimodalPanelProps {
  motor: Motor;
}

export default function MultimodalPanel({ motor }: MultimodalPanelProps) {
  const rmsDev = toDeviationIndex(motor.windows.map((w) => Number(w.rms) || 0));
  const kurtDev = toDeviationIndex(motor.windows.map((w) => Number(w.kurtosis) || 0));

  // Explicitly derived stand-ins, not real sensor data. Thermal tracks
  // vibration deviation (a motor vibrating more also tends to run hotter —
  // a real physical correlation). Acoustic tracks kurtosis (impacting /
  // knocking faults show up acoustically the same way they show up as
  // kurtosis spikes). Vibration is the only signal this system actually
  // measures.
  const thermal = rmsDev.map((v) => 40 + (v / 100) * 35);
  const acoustic = kurtDev;

  return (
    <div className="border border-[#1E212A] bg-[#111318] p-3 flex flex-col gap-3">
      <div className="text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C] leading-relaxed">
        Multimodal Inspection — thermal and acoustic below are derived overlays for demonstration, not real
        camera/microphone data. Vibration is the only signal this system actually senses.
      </div>

      <ModalityStrip label="Thermal (derived)" values={thermal} colorScale={thermalColor} band />
      <ModalityStrip label="Acoustic (derived)" values={acoustic} colorScale={() => '#A78BFA'} bar />
    </div>
  );
}

function thermalColor(temp: number) {
  const t = Math.min(1, Math.max(0, (temp - 40) / 35));
  const r = Math.round(59 + t * (239 - 59));
  const g = Math.round(130 + t * (68 - 130));
  const b = Math.round(246 + t * (68 - 246));
  return `rgb(${r},${g},${b})`;
}

function ModalityStrip({
  label,
  values,
  colorScale,
  band = false,
  bar = false,
}: {
  label: string;
  values: number[];
  colorScale: (v: number) => string;
  band?: boolean;
  bar?: boolean;
}) {
  const w = 640;
  const h = 36;
  const safe = values.length > 0 ? values : [0];
  const cellW = w / safe.length;

  return (
    <div>
      <div className="text-[9px] font-mono text-[#7C8090] mb-1">{label}</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto block">
        {safe.map((v, i) =>
          band ? (
            <rect key={i} x={i * cellW} y={0} width={cellW + 0.5} height={h} fill={colorScale(v)} />
          ) : (
            <rect
              key={i}
              x={i * cellW}
              y={h - (v / 100) * h}
              width={Math.max(cellW - 1, 1)}
              height={(v / 100) * h}
              fill={colorScale(v)}
              fillOpacity={0.8}
            />
          )
        )}
      </svg>
    </div>
  );
}