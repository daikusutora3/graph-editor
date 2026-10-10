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
import { IconButton, focusRing } from "../primitives";
import { cn } from "@/lib/utils";

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
          // This menu is hidden on touch devices; a narrow window should keep
          // its pointer target compact instead of squeezing the Select button.
          "w-6 rounded-l-none touch:w-6 touch:rounded-l-none",
          above ? "h-[52px] touch:h-[52px]" : "h-10",
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
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </IconButton>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          data-range-selection-controls
          role="menu"
          aria-label={copy.target}
          className={cn(
            "ge-panel ge-pop pointer-events-auto absolute left-0 z-50 flex w-52 max-w-[calc(100vw-2rem)] flex-col gap-0.5 rounded-xl p-1.5 backdrop-blur-[12px]",
            above ? "bottom-full mb-3" : "top-full mt-3",
          )}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) close();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close(true);
              return;
            }
            const items = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                "[role=menuitemradio]",
              ),
            ];
            const index = items.indexOf(document.activeElement as HTMLElement);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : event.key === "ArrowDown"
                    ? (index + 1) % items.length
                    : event.key === "ArrowUp"
                      ? (index - 1 + items.length) % items.length
                      : null;
            if (next !== null) {
              event.preventDefault();
              items[next]?.focus();
            }
          }}
        >
          <span className="px-2.5 py-1 text-xs text-[var(--muted)]">
            {copy.label}
          </span>
          {(["all", "nodes", "edges"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={filter === value}
              tabIndex={-1}
              className={cn(
                focusRing,
                "flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-left text-sm font-semibold text-[var(--text-2)] hover:bg-[var(--fill)]",
              )}
              onClick={() => {
                setFilter(value);
                close(true);
              }}
            >
              <span
                aria-hidden="true"
                className="grid size-4 place-items-center"
              >
                {filter === value ? <Check className="size-3.5" /> : null}
              </span>
              {copy[value]}
            </button>
          ))}
          <span className="border-t border-[var(--line)] px-2.5 pt-2 pb-1 text-xs whitespace-nowrap text-[var(--muted)]">
            {copy.hint(platform === "mac" ? "⌘" : "Ctrl")}
          </span>
        </div>
      ) : null}
    </div>
  );
}
