import { ArrowRight, MousePointer2 } from "lucide-react";

export type StartMethod = "paste" | "sample" | "draw";

const CYCLE_POINTS = [
  [50, 14],
  [75, 24],
  [86, 50],
  [75, 76],
  [50, 86],
  [25, 76],
  [14, 50],
  [25, 24],
] as const;

/** Decorative diagrams stay independent of graph layout and routing work. */
export function EmptyStateIllustration({
  method,
  tone = "accent",
}: {
  method: StartMethod;
  tone?: "accent" | "neutral";
}) {
  const activeStroke = tone === "neutral" ? "currentColor" : "var(--accent)";
  const activeFill =
    tone === "neutral" ? "var(--fill-2)" : "var(--accent-fill)";
  if (method === "paste") {
    return (
      <span
        aria-hidden="true"
        className="flex h-full w-full items-center gap-1.5"
      >
        <span
          translate="no"
          className="hidden shrink-0 rounded-md border border-[var(--line)] bg-[var(--panel-solid)] px-2 py-1.5 font-mono text-[11px] leading-relaxed text-[var(--muted)] sm:block"
        >
          0 1<br />1 2<br />2 0
        </span>
        <ArrowRight className="hidden size-3 shrink-0 text-[var(--muted)] sm:block" />
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 100 100"
          className="h-full min-w-0 flex-1"
          fill="var(--panel-solid)"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinejoin="round"
        >
          <path d="M50 22 18 76H82Z" fill="none" />
          <circle cx={50} cy={22} r={7} />
          <circle cx={18} cy={76} r={7} />
          <circle cx={82} cy={76} r={7} />
        </svg>
      </span>
    );
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      className="h-full w-full"
      fill="var(--panel-solid)"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {method === "sample" ? (
        <>
          <path
            d="M50 14 75 24 86 50 75 76 50 86 25 76 14 50 25 24Z"
            fill="none"
          />
          {CYCLE_POINTS.map(([x, y]) => (
            <circle key={`${x},${y}`} cx={x} cy={y} r={5} />
          ))}
        </>
      ) : (
        <>
          <path d="M16 70 50 24" fill="none" />
          <path
            d="M50 24 84 64"
            fill="none"
            strokeDasharray="4 5"
            stroke={activeStroke}
          />
          <circle cx={16} cy={70} r={7} />
          <circle cx={50} cy={24} r={7} />
          <circle
            cx={84}
            cy={64}
            r={7}
            fill={activeFill}
            stroke={activeStroke}
          />
          <MousePointer2
            x={76}
            y={69}
            width={23}
            height={23}
            fill="var(--panel-solid)"
            stroke={activeStroke}
          />
        </>
      )}
    </svg>
  );
}
