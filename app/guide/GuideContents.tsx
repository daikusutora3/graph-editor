"use client";

import { useRef } from "react";
import { Disclosure } from "@/components/ui/Disclosure";
import { actionStyles } from "@/components/ui/styles";
import { cn } from "@/lib/utils";
import styles from "./GuideLayout.module.css";

type ContentsEntry = { href: string; title: string };

export function GuideContents({
  title,
  entries,
}: {
  title: string;
  entries: readonly ContentsEntry[];
}) {
  const nav = useRef<HTMLElement>(null);
  return (
    <aside className={cn("mb-8 min-w-0 lg:mb-0", styles.contents)}>
      <nav ref={nav} aria-label={title}>
        <Disclosure
          title={title}
          className={cn("shadow-sm lg:hidden", styles.contentsDisclosure)}
        >
          <ContentsLinks
            entries={entries}
            className={styles.contentsList}
            onNavigate={() => {
              const disclosure = nav.current?.querySelector("details");
              if (disclosure) disclosure.open = false;
            }}
          />
        </Disclosure>
        <div className="hidden lg:block">
          <p className="mb-3 px-3 text-xs font-semibold text-[var(--muted)]">
            {title}
          </p>
          <ContentsLinks
            entries={entries}
            className={cn(
              "border-l border-[var(--line)] pl-2",
              styles.contentsList,
            )}
          />
          <p translate="no" className="mt-6 px-3 text-xs text-[var(--muted)]">
            by daikusutora3
          </p>
        </div>
      </nav>
    </aside>
  );
}

function ContentsLinks({
  entries,
  className,
  onNavigate,
}: {
  entries: readonly ContentsEntry[];
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <ol className={className}>
      {entries.map((entry) => (
        <li key={entry.href}>
          <a
            href={entry.href}
            onClick={(event) => {
              if (
                event.button === 0 &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              )
                onNavigate?.();
            }}
            className={cn(actionStyles(), "w-full text-sm leading-6")}
          >
            {entry.title}
          </a>
        </li>
      ))}
    </ol>
  );
}
