'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ThresholdNode } from '../../lib/thresholdTree';

interface LaidOutNode {
  id: string;
  label: string;
  depth: number;
  x: number;
  y: number;
  parentId: string | null;
  category: 'root' | 'fan' | 'pump';
  hasOverride: boolean;
}

const CATEGORY_COLORS: Record<LaidOutNode['category'], string> = {
  root: '#3B82F6',
  fan: '#A78BFA',
  pump: '#FB923C',
};
const CATEGORY_LABELS: Record<LaidOutNode['category'], string> = {
  root: 'Global',
  fan: 'Fan Motors',
  pump: 'Pump Motors',
};

const WIDTH = 520;
const HEIGHT = 340;
const COL_X = [50, 240, 440];

function categoryOf(id: string): LaidOutNode['category'] {
  if (id === 'global') return 'root';
  if (id.startsWith('fan')) return 'fan';
  if (id.startsWith('pump')) return 'pump';
  return 'root';
}

function layout(root: ThresholdNode): LaidOutNode[] {
  const nodes: LaidOutNode[] = [];
  const levels: ThresholdNode[][] = [];

  function collect(node: ThresholdNode, depth: number, parentId: string | null) {
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(node);
    node.children.forEach((c) => collect(c, depth + 1, node.id));
  }
  collect(root, 0, null);

  levels.forEach((levelNodes, depth) => {
    levelNodes.forEach((node, i) => {
      const y = ((i + 1) / (levelNodes.length + 1)) * HEIGHT;
      nodes.push({
        id: node.id,
        label: node.label,
        depth,
        x: COL_X[depth] ?? COL_X[COL_X.length - 1],
        y,
        parentId: findParentId(root, node.id),
        category: categoryOf(node.id),
        hasOverride: node.override !== null,
      });
    });
  });
  return nodes;
}

function findParentId(root: ThresholdNode, id: string, parent: string | null = null): string | null {
  if (root.id === id) return parent;
  for (const child of root.children) {
    const found = findParentId(child, id, root.id);
    if (found !== null || child.id === id) return child.id === id ? root.id : found;
  }
  return null;
}

interface ThresholdGraphProps {
  tree: ThresholdNode;
  selectedId: string;
  onSelect: (id: string) => void;
  flashTokens: Record<string, number>;
}

export default function ThresholdGraph({ tree, selectedId, onSelect, flashTokens }: ThresholdGraphProps) {
  const laidOut = layout(tree);
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Seed/merge computed layout positions for any node not already
  // manually positioned — preserves drags across re-renders (e.g. after
  // editing a threshold value) instead of snapping back every time.
  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev };
      let changed = false;
      laidOut.forEach((n) => {
        if (!next[n.id]) {
          next[n.id] = { x: n.x, y: n.y };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  const nodes = laidOut.map((n) => ({ ...n, x: positions[n.id]?.x ?? n.x, y: positions[n.id]?.y ?? n.y }));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const categories: LaidOutNode['category'][] = ['root', 'fan', 'pump'];

  const localPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * WIDTH,
      y: ((clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const handleMove = useCallback((e: PointerEvent) => {
    setDraggingId((id) => {
      if (!id) return id;
      const p = localPoint(e.clientX, e.clientY);
      setPositions((prev) => ({ ...prev, [id]: p }));
      return id;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopDrag = useCallback(() => {
    setDraggingId(null);
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', stopDrag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleMove]);

  const startDrag = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingId(id);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopDrag);
  };

  return (
    <div className="border border-[#1E212A] bg-[#111318] p-4">
      {/* legend */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#1E212A]">
        <div className="flex gap-4">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-1.5 text-[10px] font-mono text-[#7C8090]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[cat] }} />
              {CATEGORY_LABELS[cat]} · {nodes.filter((n) => n.category === cat).length}
            </div>
          ))}
        </div>
        <span className="text-[9px] font-mono text-[#4A4E5C]">drag nodes to rearrange</span>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto touch-none">
        {/* edges */}
        {nodes.map(
          (n) =>
            n.parentId && (
              <line
                key={`edge-${n.id}`}
                x1={byId[n.parentId].x}
                y1={byId[n.parentId].y}
                x2={n.x}
                y2={n.y}
                stroke="#2A2E3A"
                strokeWidth={1.5}
              />
            )
        )}

        {/* nodes */}
        {nodes.map((n) => {
          const color = CATEGORY_COLORS[n.category];
          const selected = n.id === selectedId;
          const flashKey = flashTokens[n.id] ?? 0;
          return (
            <g key={`${n.id}-${flashKey}`} onClick={() => onSelect(n.id)}>
              <motion.circle
                cx={n.x}
                cy={n.y}
                initial={flashKey > 0 ? { r: 18, fillOpacity: 0.5 } : false}
                animate={{ r: selected ? 12 : 9, fillOpacity: 1 }}
                transition={{ duration: draggingId === n.id ? 0 : 0.6 }}
                fill={n.hasOverride ? color : '#161A22'}
                stroke={color}
                strokeWidth={selected ? 2.5 : 1.5}
                onPointerDown={startDrag(n.id)}
                className="cursor-grab active:cursor-grabbing"
              />
              <text
                x={n.x}
                y={n.y + 22}
                textAnchor="middle"
                fontSize={9}
                fontFamily="monospace"
                fill={selected ? '#D7D9E0' : '#7C8090'}
                className="pointer-events-none select-none"
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}