import type { ArticleContent } from "@/lib/article-content";

type Example = ArticleContent["example"];

export function ArticleDiagram({
  example,
  decorative = false,
}: {
  example: Example;
  decorative?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 300 190"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : example.result}
      aria-hidden={decorative ? true : undefined}
      className="h-auto max-h-64 w-full text-[var(--text-2)]"
    >
      <ArticleGraphDrawing example={example} />
    </svg>
  );
}

export function ArticleGraphDrawing({ example }: { example: Example }) {
  const nodes = new Map(example.nodes.map((node) => [String(node[0]), node]));
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {example.id === "bipartite-graph" ? (
        <g fill="var(--fill)" stroke="var(--line)">
          <rect x="35" y="5" width="60" height="180" rx="24" />
          <rect x="205" y="5" width="60" height="180" rx="24" />
        </g>
      ) : null}
      {example.edges.map(([source, target, weight]) => {
        const from = nodes.get(String(source));
        const to = nodes.get(String(target));
        if (!from || !to) return null;
        const [, x1, y1] = from;
        const [, x2, y2] = to;
        const length = Math.hypot(x2 - x1, y2 - y1);

        const x = (x1 + x2) / 2 - ((y2 - y1) / length) * 15;
        const y = (y1 + y2) / 2 + ((x2 - x1) / length) * 15;
        return (
          <g key={`${source}-${target}`}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="1.8"
            />
            {weight !== undefined ? (
              <g>
                <rect
                  x={x - 11}
                  y={y - 11}
                  width="22"
                  height="22"
                  rx="7"
                  fill="var(--panel-solid)"
                />
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="currentColor"
                  fontSize="16"
                >
                  {weight}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
      {example.nodes.map(([id, x, y]) => (
        <g key={id}>
          <circle
            cx={x}
            cy={y}
            r="16"
            fill="var(--panel-solid)"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <text
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="currentColor"
            fontSize="16"
            fontWeight="500"
          >
            {id}
          </text>
        </g>
      ))}
    </g>
  );
}
