"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { TooltipSide } from "./tooltip-position";

export type { TooltipSide } from "./tooltip-position";

import {
  controlIcon,
  disabledControl,
  focusRing,
  pressFeedback,
  raisedControl,
} from "./control-styles";

export type ButtonVariant =
  | "ghost"
  | "secondary"
  | "choice"
  | "primary"
  | "danger"
  | "success"
  | "warning"
  | "disabled";

export type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  ghost: "bg-transparent text-[var(--text-2)] hover:bg-[var(--fill)]",
  secondary: raisedControl,
  choice:
    "border-[var(--control-border)] bg-[var(--panel-solid)] text-[var(--text-2)] hover:bg-[var(--fill)] hover:text-[var(--text)]",
  primary: "bg-[var(--primary)] text-[var(--primary-text)] hover:opacity-90",
  danger: "bg-transparent text-[var(--danger)] hover:bg-[var(--danger-fill)]",
  success: "bg-[var(--success)] text-[var(--success-text)]",
  warning: "bg-[var(--warning)] text-[var(--warning-text)]",
  disabled: disabledControl,
};

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

    layout?: "inline" | "compact" | "tile";
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
        "inline-flex shrink-0 items-center justify-center rounded-lg border font-semibold transition-colors disabled:cursor-default disabled:border-transparent disabled:bg-transparent disabled:text-[var(--faint)] disabled:shadow-none disabled:hover:bg-transparent",
        focusRing,
        variant !== "disabled" && pressFeedback,
        controlIcon,
        layout === "tile"
          ? "min-h-20 min-w-0 flex-col gap-1 px-1 py-2 text-center text-control [overflow-wrap:anywhere] whitespace-normal"
          : layout === "compact"
            ? "min-h-10 min-w-0 gap-1.5 px-2 py-2 text-control [overflow-wrap:anywhere] whitespace-normal touch:min-h-11"
            : wrap
              ? cn(
                  wrapSizeClass[size],
                  "min-w-0 [overflow-wrap:anywhere] whitespace-normal",
                )
              : cn(sizeClass[size], "whitespace-nowrap"),
        active || (variant !== "choice" && variant !== "secondary")
          ? "border-transparent"
          : undefined,
        active
          ? variant === "choice"
            ? "bg-[var(--accent-fill-soft)] text-[var(--accent-text)]"
            : "bg-[var(--accent-fill)] font-bold text-[var(--accent-text)]"
          : variantClass[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonProps, "size" | "wrap" | "layout"> & {
  label: string;
  size?: "sm" | "md" | "lg";
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
        "grid shrink-0 place-items-center transition-colors disabled:cursor-default disabled:text-[var(--faint)] disabled:hover:bg-transparent",
        focusRing,
        variant !== "disabled" && pressFeedback,
        "touch:size-11 touch:rounded-lg",
        controlIcon,
        size === "sm" && "size-[30px] rounded-md",
        size === "md" && "size-9 rounded-lg",
        size === "lg" && "size-10 rounded-lg",
        active
          ? "bg-[var(--accent-fill)] text-[var(--accent-text)]"
          : variantClass[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
