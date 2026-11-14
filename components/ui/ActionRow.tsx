"use client";

import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils";

import { focusRing, pressFeedback, rowControl } from "./control-styles";

type RowOptions = {
  /** "panel": rows aligned with panel labels. "menu": items in a floating menu. */
  density?: "panel" | "menu";
  icon?: ReactNode;
  tone?: "neutral" | "danger";
  trailing?: ReactNode;
};

type ButtonRowProps = RowOptions &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkRowProps = RowOptions &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * One full-width action row, for menus and panel action lists. Renders a link
 * when `href` is given. Use this instead of styling a raw button or anchor.
 */
export function ActionRow(props: ButtonRowProps | LinkRowProps) {
  const {
    children,
    className,
    density = "panel",
    icon,
    tone = "neutral",
    trailing,
    ...rest
  } = props;
  const rowClass = cn(
    rowControl,
    focusRing,
    pressFeedback,
    density === "menu" ? "px-2.5" : "px-1",
    "text-[var(--text-2)] disabled:cursor-default disabled:text-[var(--faint)] disabled:hover:bg-transparent",
    tone === "danger"
      ? "text-[var(--danger)] hover:bg-[var(--danger-fill)]"
      : "hover:bg-[var(--fill)] hover:text-[var(--text)]",
    className,
  );
  const content = (
    <>
      {icon ? (
        <span className="grid size-5 shrink-0 place-items-center">{icon}</span>
      ) : null}
      <span className="min-w-0 flex-1 leading-tight [overflow-wrap:anywhere]">
        {children}
      </span>
      {trailing ? (
        <span className="flex shrink-0 items-center text-meta font-medium text-[var(--muted)]">
          {trailing}
        </span>
      ) : null}
    </>
  );

  if (rest.href !== undefined) {
    return (
      <a
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
        className={rowClass}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
      className={rowClass}
    >
      {content}
    </button>
  );
}
