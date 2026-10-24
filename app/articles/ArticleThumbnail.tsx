import { ArticleGraphDrawing } from "./ArticleDiagram";
import type { ArticleContent } from "@/lib/article-content";

export function ArticleThumbnail({ article }: { article: ArticleContent }) {
  const { example, slug } = article;
  const dataToGraph = slug === "edge-list" || slug === "adjacency-matrix";
  return (
    <svg
      viewBox="0 0 400 220"
      aria-hidden="true"
      className="w-full text-[var(--text-2)]"
    >
      {dataToGraph ? (
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
          {slug === "edge-list" ? (
            <g fontFamily="monospace" fontSize="19" fill="currentColor">
              {example.input.split("\n").map((line, index) => (
                <text key={line} x="40" y={56 + index * 28}>
                  {line}
                </text>
              ))}
            </g>
          ) : (
            <g
              fontFamily="monospace"
              fontSize="18"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {[1, 2, 3].map((id, index) => (
                <g key={id} fill="var(--muted)" fontSize="13">
                  <text x={64 + index * 30} y="56">
                    {id}
                  </text>
                  <text x="32" y={87 + index * 32}>
                    {id}
                  </text>
                </g>
              ))}
              {example.input.split("\n").flatMap((row, rowIndex) =>
                row.split(" ").map((value, columnIndex) => (
                  <g
                    key={`${example.nodes[rowIndex]![0]}-${example.nodes[columnIndex]![0]}`}
                  >
                    <rect
                      x={50 + columnIndex * 30}
                      y={73 + rowIndex * 32}
                      width="28"
                      height="28"
                      rx="5"
                      fill={value === "1" ? "var(--fill-2)" : "var(--fill)"}
                    />
                    <text
                      x={64 + columnIndex * 30}
                      y={87 + rowIndex * 32}
                      fill={value === "1" ? "var(--text)" : "var(--muted)"}
                    >
                      {value}
                    </text>
                  </g>
                )),
              )}
            </g>
          )}
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
      ) : slug === "tikz-export" ? (
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
      ) : (
        <svg x="50" y="15" width="300" height="190" viewBox="0 0 300 190">
          {slug === "tree-layout" ? (
            <g stroke="var(--line)" strokeDasharray="4 6" fill="none">
              <path d="M40 95h220M40 165h220" />
              <circle cx="150" cy="25" r="23" strokeDasharray="none" />
            </g>
          ) : null}
          <ArticleGraphDrawing example={example} />
        </svg>
      )}
    </svg>
  );
}
