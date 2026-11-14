"use client";

import { useAtom, useAtomValue } from "jotai";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { useI18n } from "../../i18n/I18nProvider";
import {
  editorModeAtom,
  editorPanelAtom,
  rangeSelectionFilterAtom,
} from "../../shell/state/editor-atoms";
import { useShortcutPlatform } from "../hooks/shortcut-platform";
import { menuFocusKeyDown } from "../primitives/focus-navigation";
import { ActionRow, IconButton, splitEnd } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { menuStyle } from "@/components/ui/surfaces";

export function RangeSelectionMenu({
  onOpen,
  above = false,
}: {
  onOpen: () => void;
  above?: boolean;
}) {
  const { messages } = useI18n();
  const copy = messages.canvas.rangeSelection;
  const platform = useShortcutPlatform();
  const mode = useAtomValue(editorModeAtom);
  const panel = useAtomValue(editorPanelAtom);
  const [filter, setFilter] = useAtom(rangeSelectionFilterAtom);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) wrapperRef.current?.querySelector("button")?.focus();
  };

  useLayoutEffect(() => {
    if (open) {
      menuRef.current
        ?.querySelector<HTMLElement>("[aria-checked='true']")
        ?.focus({ preventScroll: true });
    }
  }, [open]);

  useEffect(() => {
    if (mode !== "select" || panel !== null) setOpen(false);
  }, [mode, panel]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !wrapperRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    const blur = () => setOpen(false);
    window.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("blur", blur);
    };
  }, [open]);

  if (platform === "touch") return null;

  return (
    <div
      ref={wrapperRef}
      className="relative flex"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <IconButton
        label={copy.target}
        tooltip={`${copy.target}: ${copy[filter]}`}
        tooltipSide={above ? "top" : "bottom"}
        data-range-selection-trigger
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        active={mode === "select"}
        disabled={panel !== null}
        className={cn(
          splitEnd,
          "h-11 w-6 touch:w-7",
          above && "rounded-r-xl touch:rounded-r-xl",
        )}
        onClick={() => {
          onOpen();
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            onOpen();
            setOpen(true);
            menuRef.current
              ?.querySelector<HTMLElement>("[aria-checked='true']")
              ?.focus();
          }
        }}
      >
        <ChevronDown
          className="size-3.5"
          strokeWidth={above ? 1.75 : 2}
          aria-hidden="true"
        />
      </IconButton>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          data-range-selection-controls
          role="menu"
          aria-label={copy.target}
          className={cn(
            menuStyle.surface,
            "ge-pop pointer-events-auto absolute left-0 z-50 flex w-52 max-w-[calc(100vw-2rem)] flex-col gap-0.5",
            above ? "bottom-full mb-3" : "top-full mt-3",
          )}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) close();
          }}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              close();
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close(true);
              return;
            }
            menuFocusKeyDown(event);
          }}
        >
          <span className="px-2.5 py-1 text-xs text-[var(--muted)]">
            {copy.label}
          </span>
          {(["all", "nodes", "edges"] as const).map((value) => (
            <ActionRow
              key={value}
              role="menuitemradio"
              aria-checked={filter === value}
              tabIndex={-1}
              density="menu"
              icon={
                filter === value ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  <span aria-hidden="true" />
                )
              }
              onClick={() => {
                setFilter(value);
                close(true);
              }}
            >
              {copy[value]}
            </ActionRow>
          ))}
          <span className="border-t border-[var(--line)] px-2.5 pt-2 pb-1 text-xs whitespace-nowrap text-[var(--muted)]">
            {copy.hint(platform === "mac" ? "⌘" : "Ctrl")}
          </span>
        </div>
      ) : null}
    </div>
  );
}
