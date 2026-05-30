import type { LayoutKind } from "../layouts";

type Point = {
  x: number;
  y: number;
};

export function LayoutPreview({
  kind,
  compact,
}: {
  kind: LayoutKind;
  compact?: boolean;
}) {
  const width = compact ? 46 : 58;
  const height = compact ? 34 : 42;
  const points = layoutPreviewPoints(kind, width, height);
  const edges = layoutPreviewEdges(kind, points.length);
  const radius = compact ? 2.2 : 2.6;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="block"
    >
      {edges.map(([source, target], index) => (
        <line
          key={`${source}-${target}-${index}`}
          x1={points[source].x}
          y1={points[source].y}
          x2={points[target].x}
          y2={points[target].y}
          stroke="var(--canvas-edge)"
          strokeLinecap="round"
          strokeWidth="1.25"
          opacity="0.68"
        />
      ))}
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={radius}
          fill={
            index === 0
              ? "var(--canvas-node-yellow)"
              : index === points.length - 1
                ? "var(--canvas-node-blue)"
                : "var(--canvas-node)"
          }
          stroke="var(--canvas-node-border)"
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}

function layoutPreviewPoints(
  kind: LayoutKind,
  width: number,
  height: number,
): Point[] {
  const cx = width / 2;
  const cy = height / 2;

  if (kind === "circle") {
    return ringPoints(7, cx, cy, Math.min(width, height) * 0.36);
  }

  if (kind === "grid") {
    return [
      { x: width * 0.24, y: height * 0.25 },
      { x: width * 0.5, y: height * 0.25 },
      { x: width * 0.76, y: height * 0.25 },
      { x: width * 0.24, y: height * 0.5 },
      { x: width * 0.5, y: height * 0.5 },
      { x: width * 0.76, y: height * 0.5 },
      { x: width * 0.24, y: height * 0.75 },
      { x: width * 0.5, y: height * 0.75 },
      { x: width * 0.76, y: height * 0.75 },
    ];
  }

  if (kind === "components") {
    return [
      { x: width * 0.2, y: height * 0.38 },
      { x: width * 0.34, y: height * 0.24 },
      { x: width * 0.35, y: height * 0.53 },
      { x: width * 0.68, y: height * 0.36 },
      { x: width * 0.82, y: height * 0.5 },
      { x: width * 0.62, y: height * 0.7 },
    ];
  }

  if (kind === "bfs" || kind === "dagLayer") {
    return [
      { x: width * 0.16, y: height * 0.5 },
      { x: width * 0.4, y: height * 0.28 },
      { x: width * 0.4, y: height * 0.72 },
      { x: width * 0.66, y: height * 0.28 },
      { x: width * 0.66, y: height * 0.72 },
      { x: width * 0.88, y: height * 0.5 },
    ];
  }

  if (kind === "tree") {
    return [
      { x: width * 0.5, y: height * 0.16 },
      { x: width * 0.3, y: height * 0.44 },
      { x: width * 0.7, y: height * 0.44 },
      { x: width * 0.18, y: height * 0.76 },
      { x: width * 0.42, y: height * 0.76 },
      { x: width * 0.62, y: height * 0.76 },
      { x: width * 0.84, y: height * 0.76 },
    ];
  }

  if (kind === "concentric") {
    return [
      { x: cx, y: cy },
      ...ringPoints(6, cx, cy, Math.min(width, height) * 0.35),
    ];
  }

  if (kind === "bipartite") {
    return [
      { x: width * 0.26, y: height * 0.26 },
      { x: width * 0.26, y: height * 0.5 },
      { x: width * 0.26, y: height * 0.74 },
      { x: width * 0.74, y: height * 0.26 },
      { x: width * 0.74, y: height * 0.5 },
      { x: width * 0.74, y: height * 0.74 },
    ];
  }

  if (kind === "scc") {
    return [
      ...ringPoints(3, width * 0.3, height * 0.45, height * 0.18),
      ...ringPoints(3, width * 0.72, height * 0.55, height * 0.18),
    ];
  }

  if (kind === "radial") {
    return [
      { x: cx, y: cy },
      ...ringPoints(6, cx, cy, Math.min(width, height) * 0.38),
    ];
  }

  if (kind === "line") {
    return Array.from({ length: 6 }, (_, index) => ({
      x: width * (0.14 + index * 0.145),
      y: cy,
    }));
  }

  if (kind === "spread" || kind === "force") {
    return [
      { x: width * 0.2, y: height * 0.28 },
      { x: width * 0.5, y: height * 0.18 },
      { x: width * 0.78, y: height * 0.34 },
      { x: width * 0.26, y: height * 0.72 },
      { x: width * 0.56, y: height * 0.58 },
      { x: width * 0.82, y: height * 0.76 },
    ];
  }

  return Array.from({ length: 7 }, (_, index) => {
    const angle = index * 0.84;
    const distance = Math.min(width, height) * (0.12 + index * 0.045);

    return {
      x: cx + Math.cos(angle) * distance,
      y: cy + Math.sin(angle) * distance,
    };
  });
}

function layoutPreviewEdges(
  kind: LayoutKind,
  nodeCount: number,
): Array<[number, number]> {
  if (kind === "grid") {
    return [
      [0, 1],
      [1, 2],
      [3, 4],
      [4, 5],
      [6, 7],
      [7, 8],
      [0, 3],
      [3, 6],
      [1, 4],
      [4, 7],
      [2, 5],
      [5, 8],
    ];
  }

  if (kind === "components") {
    return [
      [0, 1],
      [1, 2],
      [2, 0],
      [3, 4],
      [4, 5],
    ];
  }

  if (kind === "bfs" || kind === "dagLayer") {
    return [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 4],
      [3, 5],
      [4, 5],
    ];
  }

  if (kind === "tree") {
    return [
      [0, 1],
      [0, 2],
      [1, 3],
      [1, 4],
      [2, 5],
      [2, 6],
    ];
  }

  if (kind === "bipartite") {
    return [
      [0, 3],
      [0, 4],
      [1, 4],
      [1, 5],
      [2, 3],
      [2, 5],
    ];
  }

  if (kind === "scc") {
    return [
      [0, 1],
      [1, 2],
      [2, 0],
      [3, 4],
      [4, 5],
      [5, 3],
      [2, 3],
    ];
  }

  if (kind === "concentric" || kind === "radial") {
    return Array.from({ length: nodeCount - 1 }, (_, index) => [0, index + 1]);
  }

  if (kind === "circle") {
    return Array.from({ length: nodeCount }, (_, index) => [
      index,
      (index + 1) % nodeCount,
    ]);
  }

  if (kind === "force" || kind === "spread") {
    return [
      [0, 1],
      [1, 2],
      [0, 3],
      [3, 4],
      [2, 4],
      [4, 5],
    ];
  }

  return Array.from({ length: nodeCount - 1 }, (_, index) => [
    index,
    index + 1,
  ]);
}

function ringPoints(
  count: number,
  cx: number,
  cy: number,
  radius: number,
): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;

    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });
}
