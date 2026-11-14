"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { TooltipSide } from "./tooltip-position";

export type { TooltipSide } from "./tooltip-position";

import { controlIcon, focusRing, pressFeedback } from "./control-styles";

/**
 * Button looks. Every button is borderless; emphasis comes from the fill.
 * - primary: the one main action of a view (dark fill)
 * - secondary: other actions, choices in footers and cards (soft fill)
 * - choice: one option among several shown together (soft fill, accent when active)
 * - ghost: actions inside toolbars, bars, and rows (no fill until hover)
 * - danger / danger-ghost: destructive action as a soft fill / inside a toolbar
 * - success / warning: transient result of an action (copied, blocked)
 * - disabled: keeps the soft-fill shape for buttons that stay focusable
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "choice"
  | "ghost"
  | "danger"
  | "danger-ghost"
  | "success"
  | "warning"
  | "disabled";

export type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-[var(--primary)] text-[var(--primary-text)] hover:opacity-90",
  secondary: "bg-[var(--fill)] text-[var(--text)] hover:bg-[var(--fill-2)]",
  choice:
    "bg-[var(--fill)] text-[var(--text-2)] hover:bg-[var(--fill-2)] hover:text-[var(--text)]",
  ghost:
    "bg-transparent text-[var(--text-2)] hover:bg-[var(--fill)] hover:text-[var(--text)]",
  danger:
    "bg-[var(--danger-fill)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_22%,var(--panel-solid))]",
  "danger-ghost":
    "bg-transparent text-[var(--danger)] hover:bg-[var(--danger-fill)]",
  success: "bg-[var(--success)] text-[var(--success-text)]",
  warning: "bg-[var(--warning)] text-[var(--warning-text)]",
  disabled: "cursor-default bg-[var(--fill)] text-[var(--faint)]",
};

/** Filled looks keep their fill when natively disabled; transparent looks stay transparent. */
const filledVariants = new Set<ButtonVariant>([
  "primary",
  "secondary",
  "choice",
  "danger",
  "success",
  "warning",
  "disabled",
]);

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-xs touch:h-11 touch:px-3",
  md: "h-9 gap-1.5 px-2.5 text-control touch:h-11 touch:px-3",
  lg: "h-10 gap-2 px-3.5 text-control touch:h-11",
};

const wrapSizeClass: Record<ButtonSize, string> = {
  sm: "min-h-8 gap-1.5 px-2.5 py-2 text-xs touch:min-h-11 touch:px-3",
  md: "min-h-9 gap-1.5 px-2.5 py-2 text-control touch:min-h-11 touch:px-3",
  lg: "min-h-10 gap-2 px-3.5 py-2 text-control touch:min-h-11",
};

type TooltipProps = {
  tooltip?: string;
  tooltipSide?: TooltipSide;
};

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> &
  TooltipProps & {
    active?: boolean;
    size?: ButtonSize;
    variant?: ButtonVariant;

    wrap?: boolean;

    layout?: ButtonLayout;
    type?: "button" | "submit";
  };

function tooltipAttributes(tooltip?: string, side?: TooltipSide) {
  return tooltip
    ? {
        "data-tooltip": tooltip,
        "data-tooltip-side": side === "bottom" ? undefined : side,
      }
    : {};
}

function disabledClass(variant: ButtonVariant) {
  return filledVariants.has(variant)
    ? "disabled:cursor-default disabled:bg-[var(--fill)] disabled:text-[var(--faint)] disabled:opacity-100 disabled:hover:bg-[var(--fill)]"
    : "disabled:cursor-default disabled:text-[var(--faint)] disabled:hover:bg-transparent";
}

/** Class list for something that should look exactly like a Button (e.g. a link). */
export type ButtonLayout = "inline" | "compact" | "stacked";

const layoutClass: Record<Exclude<ButtonLayout, "inline">, string> = {
  /** Grid tiles that may wrap their label (ChoiceButton). */
  compact:
    "min-h-10 min-w-0 gap-1.5 px-2 py-2 text-control [overflow-wrap:anywhere] whitespace-normal touch:min-h-11",
  /** Icon above a short label, for mobile bars. */
  stacked:
    "h-11 min-w-11 flex-col gap-1 px-1.5 text-xs leading-none whitespace-nowrap",
};

export function buttonClass({
  active = false,
  layout = "inline",
  size = "md",
  variant = "ghost",
  wrap = false,
}: {
  active?: boolean;
  layout?: ButtonLayout;
  size?: ButtonSize;
  variant?: ButtonVariant;
  wrap?: boolean;
} = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent font-semibold transition-colors",
    focusRing,
    variant !== "disabled" && pressFeedback,
    controlIcon,
    layout !== "inline"
      ? layoutClass[layout]
      : wrap
        ? cn(
            wrapSizeClass[size],
            "min-w-0 [overflow-wrap:anywhere] whitespace-normal",
          )
        : cn(sizeClass[size], "whitespace-nowrap"),
    active
      ? variant === "choice"
        ? "bg-[var(--accent-fill-soft)] text-[var(--accent-text)]"
        : "bg-[var(--accent-fill)] font-bold text-[var(--accent-text)]"
      : variantClass[variant],
  );
}

export function Button({
  active = false,
  children,
  className,
  layout = "inline",
  size = "md",
  tooltip,
  tooltipSide,
  type = "button",
  variant = "ghost",
  wrap = false,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      {...tooltipAttributes(tooltip, tooltipSide)}
      {...props}
      className={cn(
        buttonClass({ active, layout, size, variant, wrap }),
        disabledClass(variant),
        className,
      )}
    >
      {children}
    </button>
  );
}

export type IconButtonProps = Omit<
  ButtonProps,
  "size" | "wrap" | "layout" | "variant"
> & {
  label: string;
  /** xs (24px) is for actions inside a field; touch layouts always get 44px. */
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "ghost" | "danger";
  children: ReactNode;
};

export function IconButton({
  active = false,
  children,
  className,
  label,
  size = "lg",
  tooltip,
  tooltipSide,
  variant = "ghost",
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      {...tooltipAttributes(tooltip ?? label, tooltipSide)}
      {...props}
      className={cn(
        "grid shrink-0 place-items-center transition-colors",
        focusRing,
        pressFeedback,
        "touch:size-11 touch:rounded-lg",
        controlIcon,
        size === "xs" && "size-6 rounded-md",
        size === "sm" && "size-8 rounded-lg",
        size === "md" && "size-9 rounded-lg",
        size === "lg" && "size-10 rounded-lg",
        active
          ? "bg-[var(--accent-fill)] text-[var(--accent-text)]"
          : variantClass[variant === "danger" ? "danger-ghost" : "ghost"],
        disabledClass("ghost"),
        className,
      )}
    >
      {children}
    </button>
  );
}
