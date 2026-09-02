"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { focusRing } from "./styles";

export type ButtonVariant =
  | "ghost"
  | "fill"
  | "primary"
  | "danger"
  | "success"
  | "warning"
  | "disabled";

export type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  ghost: "bg-transparent text-[var(--text-2)] hover:bg-[var(--fill)]",
  fill: "bg-[var(--fill)] text-[var(--text)] hover:bg-[var(--fill-2)]",
  primary:
    "bg-[var(--primary)] text-[var(--primary-text)] hover:opacity-90 font-semibold",
  danger: "bg-transparent text-[var(--danger)] hover:bg-[var(--danger-fill)]",
  success: "bg-[var(--success)] text-[var(--success-text)]",
  warning: "bg-[var(--warning)] text-[var(--warning-text)]",
  disabled: "cursor-default bg-[var(--fill-2)] text-[var(--faint)]",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-xs",
  md: "h-9 gap-1.5 px-2.5 text-[12.5px]",
  lg: "h-10 gap-2 px-3.5 text-[13px]",
};

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> & {
  active?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
  type?: "button" | "submit";
};

export function Button({
  active = false,
  children,
  className,
  size = "md",
  type = "button",
  variant = "ghost",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[9px] font-semibold whitespace-nowrap transition-colors disabled:cursor-default disabled:text-[var(--disabled)] disabled:hover:bg-transparent",
        focusRing,
        sizeClass[size],
        active
          ? "bg-[var(--accent-fill)] font-bold text-[var(--accent-text)]"
          : variantClass[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export type IconButtonProps = Omit<ButtonProps, "size"> & {
  label: string;
  size?: 30 | 36 | 38 | 40;
  children: ReactNode;
};

export function IconButton({
  active = false,
  children,
  className,
  label,
  size = 40,
  variant = "ghost",
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={props.title ?? label}
      {...props}
      className={cn(
        "grid shrink-0 place-items-center transition-colors disabled:cursor-default disabled:text-[var(--disabled)] disabled:hover:bg-transparent",
        focusRing,
        size === 30 && "size-[30px] rounded-[7px]",
        size === 36 && "size-9 rounded-[9px]",
        size === 38 && "size-[38px] rounded-[9px]",
        size === 40 && "size-10 rounded-[9px]",
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
