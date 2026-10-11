import Image from "next/image";
import type { ArticleContent } from "@/lib/article-content";
import { guideExamples } from "@/lib/guide-examples";

/** Shared examples use the same exported diagram as the guide. */
export function ArticleDiagram({
  example,
  decorative = false,
}: {
  example: ArticleContent["example"];
  decorative?: boolean;
}) {
  if (example.guideExampleId) {
    const guideExample = guideExamples.find(
      (entry) => entry.id === example.guideExampleId,
    );
    return (
      <div className="flex min-h-40 w-full items-center justify-center rounded-lg bg-white p-3 sm:min-h-48">
        <Image
          src={`/guide/${example.guideExampleId}.png`}
          alt={decorative ? "" : example.result}
          width={guideExample?.imageWidth ?? 1280}
          height={1280}
          unoptimized
          loading="lazy"
          className="h-auto max-h-40 w-auto max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 300 190"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : example.result}
      aria-hidden={decorative ? true : undefined}
      className="h-auto max-h-48 w-full text-[var(--text-2)]"
    >
      {example.edges.map(([source, target, weight]) => {
        const from = example.nodes.find(([id]) => id === source);
        const to = example.nodes.find(([id]) => id === target);
        if (!from || !to) return null;
        const [, x1, y1] = from;
        const [, x2, y2] = to;
        return (
          <g key={`${source}-${target}-${weight ?? "unweighted"}`}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="2"
            />
            {weight !== undefined ? (
              <text
                x={(x1 + x2) / 2 + 8}
                y={(y1 + y2) / 2 - 8}
                textAnchor="middle"
                fill="currentColor"
                fontSize="14"
              >
                {weight}
              </text>
            ) : null}
          </g>
        );
      })}
      {example.nodes.map(([id, x, y]) => (
        <g key={id}>
          <circle
            cx={x}
            cy={y}
            r="17"
            fill="var(--panel-solid)"
            stroke="currentColor"
            strokeWidth="2"
          />
          <text
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="currentColor"
            fontSize="14"
          >
            {id}
          </text>
        </g>
      ))}
    </svg>
  );
}
