'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RobotCell } from '../lib/cells';

interface CameraFeedProps {
  cell: RobotCell;
  size?: 'thumbnail' | 'large';
  imageIndex?: number;
}

/**
 * Tries to render a real photograph from /public. If the file isn't
 * there, an SVG rendering of the workspace takes over automatically.
 * Either way the image is clearly labeled as a simulated feed so it
 * can't be mistaken for a live camera.
 */
export default function CameraFeed({ cell, size = 'large', imageIndex }: CameraFeedProps) {
  const reduceMotion = useReducedMotion();
  const [imageFailed, setImageFailed] = useState(false);
  const isRunning = cell.status === 'running';
  const isOffline = cell.status === 'offline';

  const cellNum = parseInt(cell.id.replace('cell-', ''), 10) || 1;
  const idx = imageIndex ?? (((cellNum - 1) % 9) + 1);
  const photoSrc = size === 'large' ? '/cell-camera.jpg' : `/robot-cell-${idx}.jpg`;

  return (
    <div className="relative w-full h-full bg-[#08090A] overflow-hidden">
      {!imageFailed ? (
        <>
          <img
            src={photoSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImageFailed(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </>
      ) : (
        <SvgCameraFallback cell={cell} reduceMotion={reduceMotion} isRunning={isRunning} isOffline={isOffline} />
      )}

      <div className="absolute top-2 right-2 text-[8px] font-mono uppercase text-[#D7D9E0] border border-white/20 bg-black/60 backdrop-blur-sm px-1.5 py-0.5">
        Simulated feed
      </div>

      <div className="absolute top-2 left-2 text-[9px] font-mono uppercase text-[#D7D9E0] bg-black/60 backdrop-blur-sm px-1.5 py-0.5">
        CAM · {cell.name} · {cell.location}
      </div>

      {isRunning && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5 text-[9px] font-mono text-[#3B82F6] bg-black/60 backdrop-blur-sm px-1.5 py-0.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3B82F6] opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
          </span>
          LIVE
        </div>
      )}

      {isOffline && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <span className="text-sm font-mono text-[#4A4E5C]">OFFLINE</span>
        </div>
      )}
    </div>
  );
}

function SvgCameraFallback({
  cell,
  reduceMotion,
  isRunning,
  isOffline,
}: {
  cell: RobotCell;
  reduceMotion: boolean | null;
  isRunning: boolean;
  isOffline: boolean;
}) {
  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
      <defs>
        <pattern id={`grid-${cell.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#15171D" strokeWidth="0.5" />
        </pattern>
        <linearGradient id={`floor-${cell.id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#0D0F13" />
          <stop offset="1" stopColor="#15171D" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill={`url(#floor-${cell.id})`} />
      <rect width="400" height="240" fill={`url(#grid-${cell.id})`} opacity={0.6} />
      <line x1="0" y1="140" x2="400" y2="140" stroke="#1E212A" strokeWidth="1" />
      <rect x="60" y="155" width="280" height="24" fill="#161718" stroke="#2A2E3A" strokeWidth="1" />
      {!isOffline && (
        <motion.rect
          x="180" y="145" width="32" height="16"
          fill="#3D4552" stroke="#4A4E5C" strokeWidth="0.5"
          animate={reduceMotion || !isRunning ? {} : { x: [180, 220, 260, 300, 340, 60, 100, 140, 180] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 12, repeat: Infinity, ease: 'linear' }}
        />
      )}
      <line x1="80" y1="60" x2="80" y2="180" stroke="#3D4552" strokeWidth="2" />
      <line x1="320" y1="60" x2="320" y2="180" stroke="#3D4552" strokeWidth="2" />
      <line x1="76" y1="60" x2="324" y2="60" stroke="#3D4552" strokeWidth="2" />
      <rect x="188" y="60" width="24" height="12" fill="#4A4E5C" />
      <motion.g
        animate={reduceMotion || !isRunning ? {} : { rotate: [0, 25, -15, 10, 0] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '200px 66px' }}
      >
        <rect x="197" y="66" width="6" height="52" fill="#7C8090" rx="1" />
        <circle cx="200" cy="118" r="4" fill="#818CF8" />
        <motion.g
          animate={reduceMotion || !isRunning ? {} : { rotate: [0, -20, 30, -10, 0] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '200px 118px' }}
        >
          <rect x="197" y="118" width="6" height="30" fill="#7C8090" rx="1" />
          <rect x="193" y="146" width="14" height="6" fill="#22D3EE" opacity={isRunning ? 0.9 : 0.5} />
        </motion.g>
      </motion.g>
    </svg>
  );
}