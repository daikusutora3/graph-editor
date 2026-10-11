import {
  Circle,
  MousePointer2,
  Move,
  MoveDiagonal,
  Plus,
  GitBranch,
  Maximize2,
  Check,
  ArrowRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { guideVisualCopy } from "@/lib/guide-visual-content";
import type { AppLocale } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

type Point = readonly [number, number];
const triangle: readonly Point[] = [
  [120, 60],
  [76, 116],
  [164, 116],
];
const tree: readonly Point[] = [
  [120, 54],
  [66, 94],
  [174, 94],
  [150, 128],
  [198, 128],
];
const triangleEdges = [
  [0, 1],
  [1, 2],
  [2, 0],
] as const;
const treeEdges = [
  [0, 1],
  [0, 2],
  [2, 3],
  [2, 4],
] as const;

/** Schematic operations, rather than screenshots of a particular toolbar width. */
export function GuideOperationVisual({
  id,
  locale,
}: {
  id: string;
  locale: AppLocale;
}) {
  const captions = guideVisualCopy[locale].captions[id];
  if (!captions) return null;
  return (
    <div
      className={cn(
        "mt-5 grid gap-4 sm:gap-5",
        captions.length === 4 ? "sm:grid-cols-2" : "sm:grid-cols-3",
      )}
    >
      {captions.map((caption, index) => (
        <figure
          key={caption}
          className="grid min-w-0 grid-cols-[8rem_minmax(0,1fr)] items-center gap-3 sm:block"
        >
          <svg
            viewBox="0 0 240 156"
            aria-hidden="true"
            focusable="false"
            className="aspect-[240/156] w-full overflow-hidden rounded-xl bg-[var(--fill)] text-[var(--text-2)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect
              x="14"
              y="12"
              width="212"
              height="134"
              rx="10"
              fill="var(--panel-solid)"
              stroke="var(--line)"
            />
            <Operation id={id} step={index} />
          </svg>
          <figcaption className="flex min-h-11 items-start gap-2 text-sm leading-6 font-medium sm:items-center sm:px-1 sm:pt-2">
            {id === "export" || id === "appearance" ? null : (
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--fill)] text-[11px] text-[var(--muted)]"
                aria-hidden="true"
              >
                {index + 1}
              </span>
            )}
            {caption}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function Graph({
  points = triangle,
  edges = triangleEdges,
  selected = -1,
  label,
  directed = false,
}: {
  points?: readonly Point[];
  edges?: readonly (readonly [number, number])[];
  selected?: number;
  label?: string;
  directed?: boolean;
}) {
  return (
    <>
      {edges.map(([a, b]) => {
        const start = points[a]!;
        const end = points[b]!;
        const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
        const x = end[0] - Math.cos(angle) * 11,
          y = end[1] - Math.sin(angle) * 11;
        return (
          <g key={`${a}-${b}`}>
            <path d={`M${start[0]} ${start[1]} L${end[0]} ${end[1]}`} />
            {directed ? (
              <path
                d={`M${x - Math.cos(angle - 0.5) * 7} ${y - Math.sin(angle - 0.5) * 7} L${x} ${y} L${x - Math.cos(angle + 0.5) * 7} ${y - Math.sin(angle + 0.5) * 7}`}
              />
            ) : null}
          </g>
        );
      })}
      {points.map(([x, y], index) => (
        <g key={`${x},${y}`}>
          {selected === index ? (
            <circle
              cx={x}
              cy={y}
              r="15"
              strokeDasharray="3 4"
              stroke="var(--muted)"
            />
          ) : null}
          <circle
            cx={x}
            cy={y}
            r="9"
            fill={selected === index ? "var(--fill-2)" : "var(--panel-solid)"}
          />
          <text
            x={x}
            y={y + 3.5}
            stroke="none"
            fill="currentColor"
            fontSize="10"
            textAnchor="middle"
          >
            {index === 0 && label ? label : index + 1}
          </text>
        </g>
      ))}
    </>
  );
}

function Toolbar({ active }: { active: number }) {
  return (
    <>
      <path d="M14 40H226" stroke="var(--line)" />
      {[
        { id: "select", Icon: MousePointer2 },
        { id: "node", Icon: Circle },
        { id: "edge", Icon: GitBranch },
      ].map(({ id, Icon }, index) => (
        <g key={id}>
          {active === index ? (
            <rect
              x={22 + index * 30}
              y="17"
              width="24"
              height="18"
              rx="4"
              fill="var(--fill-2)"
              stroke="none"
            />
          ) : null}
          <Icon x={28 + index * 30} y={20} width="12" height="12" />
        </g>
      ))}
    </>
  );
}

function Mono({
  children,
  x = 32,
  y = 58,
}: {
  children: ReactNode;
  x?: number;
  y?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      stroke="none"
      fontSize="12"
      fontFamily="monospace"
      xmlSpace="preserve"
    >
      {children}
    </text>
  );
}

function Operation({ id, step }: { id: string; step: number }) {
  if (id === "import")
    return (
      <>
        {step === 0 ? (
          <>
            <rect
              x="29"
              y="28"
              width="182"
              height="83"
              rx="5"
              stroke="var(--line)"
            />
            {["3 3", "1 2", "2 3", "3 1"].map((line, index) => (
              <Mono key={line} x={42} y={46 + index * 17}>
                {line}
              </Mono>
            ))}
            <path d="M72 78V96" />
          </>
        ) : (
          <>
            <Toolbar active={-1} />
            <Graph />
          </>
        )}
        {step === 1 ? <Check x="185" y="50" width="18" height="18" /> : null}
        {step === 2 ? (
          <>
            <rect
              x="177"
              y="117"
              width="35"
              height="20"
              rx="5"
              fill="var(--text)"
              stroke="none"
            />
            <Check
              x="187"
              y="121"
              width="13"
              height="13"
              stroke="var(--panel-solid)"
            />
          </>
        ) : null}
      </>
    );
  if (id === "draw")
    return (
      <>
        <Toolbar active={step === 0 ? 1 : step === 1 ? 2 : 0} />
        <Graph
          points={
            step === 2
              ? [
                  [145, 64],
                  [76, 116],
                  [164, 116],
                ]
              : triangle
          }
          edges={
            step === 0
              ? []
              : [
                  [0, 1],
                  [1, 2],
                ]
          }
          selected={step === 0 ? -1 : 0}
        />
        {step === 0 ? (
          <>
            <Plus x="170" y="76" width="18" height="18" />
            <MousePointer2 x="180" y="90" width="20" height="20" />
          </>
        ) : null}
        {step === 1 ? (
          <>
            <path d="M120 60 164 116" strokeDasharray="4 5" />
            <MousePointer2 x="167" y="116" width="20" height="20" />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <circle
              cx="111"
              cy="68"
              r="9"
              strokeDasharray="3 4"
              stroke="var(--muted)"
            />
            <ArrowRight x="114" y="48" width="23" height="20" />
            <MousePointer2 x="150" y="71" width="20" height="20" />
          </>
        ) : null}
      </>
    );
  if (id === "appearance")
    return (
      <>
        <Toolbar active={0} />
        <Graph
          selected={step === 0 ? 0 : -1}
          label={step === 1 ? "A" : undefined}
          directed={step === 2}
        />
        {step === 0 ? (
          <>
            {["var(--panel-solid)", "var(--text)", "#d97757", "#65a085"].map(
              (color, index) => (
                <circle
                  key={color}
                  cx={169 + index * 13}
                  cy="59"
                  r="4.5"
                  fill={color}
                />
              ),
            )}
            <MousePointer2 x="199" y="62" width="17" height="17" />
          </>
        ) : null}
        {step === 1 ? (
          <>
            <rect
              x="144"
              y="48"
              width="59"
              height="23"
              rx="4"
              fill="var(--panel-solid)"
              stroke="var(--line)"
            />
            <Mono x={153} y={64}>
              A |
            </Mono>
          </>
        ) : null}
      </>
    );
  if (id === "layouts")
    return (
      <>
        {step === 0 ? (
          <>
            <rect
              x="27"
              y="31"
              width="83"
              height="97"
              rx="6"
              stroke="var(--line)"
            />
            <rect
              x="127"
              y="31"
              width="83"
              height="97"
              rx="6"
              stroke="currentColor"
            />
            <circle cx="68" cy="78" r="25" strokeDasharray="4 7" />
            <path d="M170 57 150 94 M170 57 191 94" />
            <circle cx="170" cy="57" r="5" />
            <circle cx="150" cy="94" r="5" />
            <circle cx="191" cy="94" r="5" />
            <MousePointer2 x="181" y="109" width="20" height="20" />
          </>
        ) : (
          <>
            <Toolbar active={-1} />
            <Graph
              points={
                step === 1
                  ? [
                      [70, 57],
                      [175, 64],
                      [105, 116],
                      [164, 127],
                      [191, 96],
                    ]
                  : tree
              }
              edges={treeEdges}
            />
            {step === 1 ? (
              <>
                <rect
                  x="162"
                  y="18"
                  width="51"
                  height="18"
                  rx="4"
                  fill="var(--fill-2)"
                  stroke="none"
                />
                <GitBranch x="167" y="21" width="12" height="12" />
                <MousePointer2 x="198" y="28" width="17" height="17" />
              </>
            ) : null}
          </>
        )}
      </>
    );
  if (id === "export")
    return (
      <>
        <path
          d="M45 26H164L195 56V133H45Z"
          fill="var(--panel-solid)"
          stroke="var(--line)"
        />
        <path d="M164 26V56H195" stroke="var(--line)" />
        <Mono x={58} y={50}>
          {[".json", ".png", ".txt", ".tex"][step]}
        </Mono>
        {step === 0 ? (
          <>
            <Mono x={61} y={78}>
              {'{ "nodes": […],'}
            </Mono>
            <Mono x={72} y={97}>
              {'"edges": […]'}
            </Mono>
            <Mono x={61} y={116}>
              {"}"}
            </Mono>
          </>
        ) : step === 1 ? (
          <g transform="translate(20,28) scale(.7)">
            <Graph />
          </g>
        ) : step === 2 ? (
          ["3 3", "1 2", "2 3", "3 1"].map((line, index) => (
            <Mono key={line} x={63} y={73 + index * 17}>
              {line}
            </Mono>
          ))
        ) : (
          <>
            <Mono x={58} y={79}>
              {"\\begin{tikzpicture}"}
            </Mono>
            <path d="M65 93H153M65 104H140M65 115H167" stroke="var(--line)" />
          </>
        )}
      </>
    );
  if (id === "touch")
    return (
      <>
        <Toolbar active={0} />
        <Graph
          points={
            step === 0
              ? [
                  [144, 70],
                  [100, 126],
                  [188, 126],
                ]
              : step === 1
                ? [
                    [120, 62],
                    [63, 129],
                    [177, 129],
                  ]
                : triangle
          }
        />
        {step === 0 ? (
          <>
            <Move x="34" y="70" width="25" height="25" />
            <MousePointer2 x="49" y="88" width="20" height="20" />
          </>
        ) : step === 1 ? (
          <>
            <circle
              cx="97"
              cy="88"
              r="12"
              fill="var(--panel-solid)"
              strokeDasharray="3 3"
            />
            <circle
              cx="150"
              cy="108"
              r="12"
              fill="var(--panel-solid)"
              strokeDasharray="3 3"
            />
            <MoveDiagonal x="104" y="89" width="39" height="24" />
          </>
        ) : (
          <>
            <rect
              x="179"
              y="118"
              width="30"
              height="20"
              rx="4"
              fill="var(--fill)"
              stroke="none"
            />
            <Maximize2 x="188" y="122" width="12" height="12" />
            <MousePointer2 x="199" y="128" width="17" height="17" />
          </>
        )}
      </>
    );
  return null;
}
