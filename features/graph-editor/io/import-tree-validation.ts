export function inferTreeIndexBase(
  labels: number[],
  nodeCount: number,
  fallback: 0 | 1 | undefined,
) {
  const allZeroBased = labels.every((value) => value >= 0 && value < nodeCount);
  const allOneBased = labels.every((value) => value >= 1 && value <= nodeCount);

  if (allOneBased) {
    return 1;
  }
  if (allZeroBased) {
    return 0;
  }
  return fallback ?? 1;
}

export function isRootedParentTreeLabels(
  parentLabels: number[],
  nodeCount: number,
  fallback: 0 | 1 | undefined,
) {
  if (parentLabels.length !== nodeCount - 1) {
    return false;
  }

  const indexBase = inferTreeIndexBase(parentLabels, nodeCount, fallback);
  const state = new Uint8Array(nodeCount);
  state[0] = 2;

  for (let start = 1; start < nodeCount; start += 1) {
    if (state[start] !== 0) {
      continue;
    }

    let current = start;
    const path: number[] = [];
    while (state[current] === 0) {
      state[current] = 1;
      path.push(current);
      const label = parentLabels[current - 1];
      if (
        label == null ||
        label < indexBase ||
        label >= indexBase + nodeCount
      ) {
        return false;
      }
      current = label - indexBase;
    }

    if (state[current] === 1) {
      return false;
    }

    for (const node of path) {
      state[node] = 2;
    }
  }

  return true;
}

export function isUndirectedTreeLabels(
  edges: ReadonlyArray<readonly [number, number]>,
  nodeCount: number,
  fallback: 0 | 1 | undefined,
) {
  if (edges.length !== nodeCount - 1) {
    return false;
  }

  const labels = edges.flatMap(([left, right]) => [left, right]);
  const indexBase = inferTreeIndexBase(labels, nodeCount, fallback);
  const parents = Array.from({ length: nodeCount }, (_, index) => index);

  const find = (node: number) => {
    let root = node;
    while ((parents[root] ?? root) !== root) {
      root = parents[root] ?? root;
    }
    while ((parents[node] ?? node) !== node) {
      const next = parents[node] ?? node;
      parents[node] = root;
      node = next;
    }
    return root;
  };

  for (const [leftLabel, rightLabel] of edges) {
    const left = leftLabel - indexBase;
    const right = rightLabel - indexBase;
    if (
      left < 0 ||
      left >= nodeCount ||
      right < 0 ||
      right >= nodeCount ||
      left === right
    ) {
      return false;
    }

    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot === rightRoot) {
      return false;
    }
    parents[leftRoot] = rightRoot;
  }

  // With nodeCount - 1 valid, non-cyclic edges, the graph is connected.
  return true;
}
