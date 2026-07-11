'use client';
import { useState } from 'react';
import Card from './ui/Card';
import ThresholdTree from './setup/ThresholdTree';
import ThresholdEditor from './setup/ThresholdEditor';
import {
  DEFAULT_TREE,
  computeEffectiveMap,
  findNode,
  updateNodeOverride,
  collectInheritingDescendants,
  ThresholdValues,
} from '../lib/thresholdTree';

export default function SetupWizard() {
  const [tree, setTree] = useState(DEFAULT_TREE);
  const [selectedId, setSelectedId] = useState('global');
  const [flashTokens, setFlashTokens] = useState<Record<string, number>>({});

  const effectiveMap = computeEffectiveMap(tree, tree.override!);
  const selectedNode = findNode(tree, selectedId)!;
  const affected = collectInheritingDescendants(selectedNode);

  const handleChange = (override: ThresholdValues | null) => {
    setTree((prev) => updateNodeOverride(prev, selectedId, override));

    // Flash the selected node plus every descendant whose effective value
    // actually changes as a result — this is the "propagation you can see"
    // moment, the whole point of the tree structure.
    const affectedIds = [selectedId, ...collectInheritingDescendants(selectedNode)];
    setFlashTokens((prev) => {
      const next = { ...prev };
      affectedIds.forEach((id) => {
        next[id] = (next[id] ?? 0) + 1;
      });
      return next;
    });
  };

  return (
    <div className="p-4 flex gap-3" style={{ height: 'calc(100vh - 40px)' }}>
      <Card padded={false} className="w-64 shrink-0 overflow-y-auto py-2">
        <div className="px-2 pb-2 mb-1 border-b border-[#1E212A] text-[9px] font-mono uppercase tracking-wide text-[#4A4E5C]">
          Threshold Hierarchy
        </div>
        <ThresholdTree
          node={tree}
          effectiveMap={effectiveMap}
          selectedId={selectedId}
          onSelect={setSelectedId}
          flashTokens={flashTokens}
        />
      </Card>

      <Card padded={false} className="flex-1 overflow-y-auto">
        <ThresholdEditor
          node={selectedNode}
          effective={effectiveMap[selectedId]}
          affectedCount={affected.length}
          onChange={handleChange}
        />
      </Card>
    </div>
  );
}