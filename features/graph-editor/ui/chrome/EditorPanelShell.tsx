"use client";

import { X } from "lucide-react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { useI18n } from "../../i18n/I18nProvider";
import { IconButton } from "../primitives";
import { tabbableElements } from "../primitives/focus-navigation";
import type {
  EditorLayout,
  EditorPanel,
} from "../../shell/state/editor-layout";

type EditorPanelShellProps = {
  bodyClassName?: string;
  scrollOwner?: "body" | "child";
  children: ReactNode;
  footer?: ReactNode;
  layout: EditorLayout;
  meta?: string;
  onClose: () => void;
  panel: EditorPanel;
  state: "open" | "closing";
  title: string;
  width?: number;
};

const CHROME_CONTROL_SELECTOR = "[data-editor-chrome-control='true']";
function firstFocusable(root: HTMLElement | null) {
  const elements = tabbableElements(root);
  // Prefer the first control after the close button so keyboard users land
  // on the panel's own content.
  return (
    elements.find((element) => element.dataset.panelClose !== "true") ??
    elements[0] ??
    null
  );
}

function trapTab(event: ReactKeyboardEvent, root: HTMLElement | null) {
  const elements = tabbableElements(root);

  if (elements.length === 0) {
    return;
  }

  const first = elements[0];
  const last = elements[elements.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && (active === first || active === root)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function EditorPanelShell({
  bodyClassName,
  scrollOwner = "body",
  children,
  footer,
  layout,
  meta,
  onClose,
  panel,
  state,
  title,
  width,
}: EditorPanelShellProps) {
  const { messages } = useI18n();
  const sectionRef = useRef<HTMLElement | null>(null);
  const mobile = layout === "mobile";
  const mobileSheet = mobile && panel !== "app";
  const fullscreen = mobile && panel === "starter";
  const modal = panel === "starter" || panel === "shortcuts";
  const [anchorPosition, setAnchorPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (mobileSheet || modal) {
      setAnchorPosition(null);
      return;
    }
    const section = sectionRef.current;
    const container = section?.closest<HTMLElement>("[data-layout]");
    const anchor = container?.querySelector<HTMLElement>(
      `[data-editor-panel-trigger="${panel === "menu" ? "settings" : panel}"]`,
    );
    if (!section || !container || !anchor) {
      setAnchorPosition(null);
      return;
    }

    const updatePosition = () => {
      const bounds = container.getBoundingClientRect();
      const trigger = anchor.getBoundingClientRect();
      const margin = mobile ? 12 : 16;
      const panelWidth = section.offsetWidth;
      const desiredLeft =
        panel === "app"
          ? trigger.left - bounds.left
          : panel === "export" || panel === "png"
            ? trigger.right - bounds.left - panelWidth
            : trigger.left - bounds.left + (trigger.width - panelWidth) / 2;
      const left = Math.max(
        margin,
        Math.min(desiredLeft, bounds.width - panelWidth - margin),
      );
      const top = Math.max(
        margin,
        Math.min(
          trigger.bottom - bounds.top + 8,
          bounds.height - section.offsetHeight - margin,
        ),
      );
      setAnchorPosition((current) =>
        current?.left === left && current.top === top ? current : { left, top },
      );
    };
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(container);
    observer.observe(anchor);
    observer.observe(section);
    return () => observer.disconnect();
  }, [mobile, mobileSheet, modal, panel]);

  useEffect(() => {
    if (state !== "open") {
      return;
    }

    const section = sectionRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusTimeout = window.setTimeout(() => {
      // A user may start typing before this delayed initial focus runs.
      // Preserve any control they have already focused inside the panel.
      if (
        document.activeElement !== section &&
        section?.contains(document.activeElement)
      ) {
        return;
      }
      const first = firstFocusable(section);
      (first ?? section)?.focus({ preventScroll: true });
    }, 30);

    return () => {
      window.clearTimeout(focusTimeout);

      if (
        previouslyFocused &&
        previouslyFocused.isConnected &&
        (document.activeElement === document.body ||
          section?.contains(document.activeElement))
      ) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [panel, state]);

  useEffect(() => {
    if (state !== "open") {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (
        sectionRef.current?.contains(event.target) ||
        (event.target instanceof Element &&
          event.target.closest(CHROME_CONTROL_SELECTOR))
      ) {
        return;
      }

      if (panel === "layouts" && !mobile) {
        return;
      }

      onClose();
    };

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mobile, onClose, panel, state]);

  const positionStyle: CSSProperties | undefined = (() => {
    if (mobileSheet) {
      return undefined;
    }

    if (!modal) {
      return {
        top: anchorPosition?.top ?? 76,
        left: anchorPosition?.left ?? 16,
        width:
          width ??
          (panel === "app"
            ? 264
            : panel === "settings"
              ? 340
              : panel === "layouts" || panel === "menu"
                ? 372
                : 384),
      };
    }

    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: width ?? (panel === "shortcuts" ? 640 : 560),
    };
  })();

  return (
    <>
      {mobile || modal ? (
        <div
          aria-hidden="true"
          data-panel-state={state}
          className={cn(
            "ge-scrim absolute inset-0 z-[80] bg-[var(--scrim)]",
            !mobile && "opacity-60",
          )}
          onClick={onClose}
        />
      ) : null}
      <div
        className={cn(
          "absolute z-[90] max-w-[calc(100%-32px)]",
          mobileSheet && "inset-x-0 bottom-0 max-w-none",
          fullscreen && "inset-0",
        )}
        style={positionStyle}
      >
        <section
          ref={sectionRef}
          role="dialog"
          aria-modal={mobile || modal ? true : undefined}
          aria-label={title}
          data-panel-state={state}
          data-editor-panel={panel}
          className={cn(
            "flex min-h-0 flex-col overflow-hidden",
            scrollOwner === "child" &&
              !fullscreen &&
              "h-[min(760px,calc(var(--ge-viewport-height,100dvh)-80px))]",
            mobileSheet
              ? cn(
                  "ge-sheet bg-[var(--panel-solid)] shadow-[0_-12px_40px_-20px_rgb(17_24_39/0.3)]",
                  fullscreen
                    ? "h-full max-h-full rounded-none"
                    : "max-h-[calc(var(--ge-viewport-height,100dvh)*0.84)] rounded-t-[20px]",
                )
              : cn(
                  "ge-popover ge-panel rounded-xl shadow-[var(--shadow-lg)] backdrop-blur-[16px]",
                  modal
                    ? "ge-modal-panel max-h-[calc(var(--ge-viewport-height,100dvh)-80px)]"
                    : "max-h-[calc(var(--ge-viewport-height,100dvh)-100px)]",
                ),
          )}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onClose();
              return;
            }

            if (event.key === "Tab" && (modal || mobile)) {
              trapTab(event, sectionRef.current);
            }
          }}
        >
          {mobileSheet && !fullscreen ? (
            <div className="flex justify-center pt-2">
              <span className="h-1 w-9 rounded-full bg-[var(--fill-2)]" />
            </div>
          ) : null}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--hair)] pr-2 pl-4">
            <span className="flex min-w-0 items-baseline gap-2.5">
              <h2 className="truncate text-sm font-bold text-[var(--text)]">
                {title}
              </h2>
              {meta ? (
                <span className="font-mono text-meta font-semibold text-[var(--muted)]">
                  {meta}
                </span>
              ) : null}
            </span>
            <IconButton
              data-panel-close="true"
              label={messages.common.close}
              size="md"
              tooltip={`${messages.common.close} (Esc)`}
              tooltipSide="bottom-end"
              className="text-[var(--muted)] hover:text-[var(--text)]"
              onClick={onClose}
            >
              <X className="size-4" />
            </IconButton>
          </div>
          <div
            className={cn(
              // Children keep their natural height; long content scrolls instead of
              // squeezing controls above it.
              scrollOwner === "body"
                ? "ge-scrollbar flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-4 pt-3.5 pb-4 [&>*]:shrink-0"
                : "flex min-h-0 flex-1 flex-col overflow-hidden",
              bodyClassName,
            )}
          >
            {children}
          </div>
          {footer ? (
            <div className="flex shrink-0 items-center gap-2 border-t border-[var(--hair)] bg-[var(--bg)] px-4 py-3">
              {footer}
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
