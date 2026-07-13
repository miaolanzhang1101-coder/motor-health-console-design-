export interface ThresholdValues {
  watch: number;
  critical: number;
}

export interface ThresholdNode {
  id: string;
  label: string;
  override: ThresholdValues | null; // null = inherits from parent
  children: ThresholdNode[];
}

export const DEFAULT_TREE: ThresholdNode = {
  id: 'global',
  label: 'Global Default',
  override: { watch: 40, critical: 70 },
  children: [
    {
      id: 'fan',
      label: 'Fan Motors',
      override: null,
      children: [
        { id: 'fan-a1', label: 'motor_A1', override: null, children: [] },
        { id: 'fan-a2', label: 'motor_A2', override: null, children: [] },
      ],
    },
    {
      id: 'pump',
      label: 'Pump Motors',
      override: { watch: 35, critical: 65 },
      children: [
        { id: 'pump-b1', label: 'motor_B1', override: null, children: [] },
        { id: 'pump-b2', label: 'motor_B2', override: { watch: 45, critical: 80 }, children: [] },
      ],
    },
  ],
};

/** Computes each node's effective (inherited-or-own) threshold values. */
export function computeEffectiveMap(
  node: ThresholdNode,
  inherited: ThresholdValues,
  map: Record<string, ThresholdValues> = {}
): Record<string, ThresholdValues> {
  const effective = node.override ?? inherited;
  map[node.id] = effective;
  node.children.forEach((child) => computeEffectiveMap(child, effective, map));
  return map;
}

/** Maps a motor's file name to its node in the threshold hierarchy. Motors
 * not explicitly mapped fall back to the global default. */
export const MOTOR_NODE_MAP: Record<string, string> = {
  'motor_A1.mat': 'fan-a1',
  'motor_A2.mat': 'fan-a2',
  'motor_B1.mat': 'pump-b1',
  'motor_B2.mat': 'pump-b2',
};

export function getMotorTypeLabel(motorFile: string): string {
  const nodeId = MOTOR_NODE_MAP[motorFile];
  if (nodeId?.startsWith('fan')) return 'Fan Motor';
  if (nodeId?.startsWith('pump')) return 'Pump Motor';
  return 'Unclassified';
}

export function getEffectiveThresholdsForMotor(
  tree: ThresholdNode,
  motorFile: string
): ThresholdValues {
  const nodeId = MOTOR_NODE_MAP[motorFile] ?? 'global';
  const map = computeEffectiveMap(tree, tree.override!);
  return map[nodeId] ?? map['global'];
}
export function getAncestryChain(tree: ThresholdNode, id: string): ThresholdNode[] {
  const chain: ThresholdNode[] = [];
  function walk(node: ThresholdNode, path: ThresholdNode[]): boolean {
    const nextPath = [...path, node];
    if (node.id === id) {
      chain.push(...nextPath);
      return true;
    }
    for (const child of node.children) {
      if (walk(child, nextPath)) return true;
    }
    return false;
  }
  walk(tree, []);
  return chain;
}

export function diffTrees(live: ThresholdNode, draft: ThresholdNode): { id: string; label: string }[] {
  const changes: { id: string; label: string }[] = [];
  function walk(a: ThresholdNode, b: ThresholdNode) {
    if (JSON.stringify(a.override) !== JSON.stringify(b.override)) {
      changes.push({ id: b.id, label: b.label });
    }
    a.children.forEach((childA, i) => walk(childA, b.children[i]));
  }
  walk(live, draft);
  return changes;
}

export function findParentNode(tree: ThresholdNode, id: string): ThresholdNode | null {
  for (const child of tree.children) {
    if (child.id === id) return tree;
    const found = findParentNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findNode(tree: ThresholdNode, id: string): ThresholdNode | null {
  if (tree.id === id) return tree;
  for (const child of tree.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function updateNodeOverride(tree: ThresholdNode, id: string, override: ThresholdValues | null): ThresholdNode {
  if (tree.id === id) return { ...tree, override };
  return { ...tree, children: tree.children.map((c) => updateNodeOverride(c, id, override)) };
}

/**
 * Every descendant of `node` that does NOT have its own override — i.e.
 * every node whose effective value will actually change when `node`'s
 * value changes. This is what should visually flash when a parent edit
 * propagates.
 */
export function collectInheritingDescendants(node: ThresholdNode): string[] {
  let ids: string[] = [];
  for (const child of node.children) {
    if (!child.override) {
      ids.push(child.id);
      ids = ids.concat(collectInheritingDescendants(child));
    }
  }
  return ids;
}