import { ArticleGraphDrawing } from "./ArticleDiagram";
import type { ArticleContent } from "@/lib/article-content";

export function ArticleThumbnail({ article }: { article: ArticleContent }) {
  const { example, slug } = article;
  return (
    <svg
      viewBox="0 0 400 220"
      aria-hidden="true"
      className="w-full text-[var(--text-2)]"
    >
      {slug === "edge-list" ? (
        <>
          <rect
            x="10"
            y="26"
            width="138"
            height="168"
            rx="12"
            fill="var(--panel-solid)"
            stroke="var(--line)"
          />
          <g fontFamily="monospace" fontSize="19" fill="currentColor">
            {example.input.split("\n").map((line, index) => (
              <text key={line} x="40" y={56 + index * 28}>
                {line}
              </text>
            ))}
          </g>
          <path
            d="M160 110h23m-6-6 6 6-6 6"
            fill="none"
            stroke="var(--muted)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <svg x="185" y="25" width="205" height="170" viewBox="20 0 260 190">
            <ArticleGraphDrawing example={example} />
          </svg>
        </>
      ) : (
        <>
          <rect
            x="95"
            y="9"
            width="210"
            height="202"
            rx="9"
            fill="var(--panel-solid)"
            stroke="var(--line)"
          />
          <text
            x="113"
            y="34"
            fontFamily="monospace"
            fontSize="14"
            fill="var(--muted)"
          >
            TikZ / LaTeX
          </text>
          <path
            d="M113 48h150m-150 8h116M113 184h172m-172 8h136"
            stroke="var(--line)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <svg x="112" y="64" width="177" height="109" viewBox="20 0 260 190">
            <ArticleGraphDrawing example={example} />
          </svg>
        </>
      )}
    </svg>
  );
}
