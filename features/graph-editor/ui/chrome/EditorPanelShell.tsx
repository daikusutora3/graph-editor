"use client";

import { X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import { useI18n } from "../../i18n/I18nProvider";
import { IconButton } from "../primitives";
import type {
  EditorLayout,
  EditorPanel,
} from "../../shell/state/editor-layout";

type EditorPanelShellProps = {
  bodyClassName?: string;
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

export function EditorPanelShell({
  bodyClassName,
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
  const fullscreen = mobile && panel === "starter";
  const modal = panel === "starter" || panel === "shortcuts";

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
    if (mobile) {
      return undefined;
    }

    if (panel === "layouts" || panel === "menu") {
      return {
        top: 76,
        left: "50%",
        transform: "translateX(calc(-50% + 150px))",
        width: width ?? 372,
      };
    }

    if (panel === "settings") {
      return {
        top: 76,
        left: "50%",
        transform: `translateX(calc(-50% + ${layout === "compact" ? 150 : 236}px))`,
        width: width ?? 340,
      };
    }

    if (panel === "export" || panel === "png") {
      return { top: 72, right: 16, width: width ?? 384 };
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
      {mobile ? (
        <div
          aria-hidden="true"
          data-panel-state={state}
          className="ge-scrim absolute inset-0 z-[80] bg-[var(--scrim)]"
          onClick={onClose}
        />
      ) : null}
      <div
        className={cn(
          "absolute z-[90] max-w-[calc(100%-32px)]",
          mobile && "inset-x-0 bottom-0 max-w-none",
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
            mobile
              ? cn(
                  "ge-sheet bg-[var(--panel-solid)] shadow-[0_-12px_40px_-20px_rgb(17_24_39/0.3)]",
                  fullscreen
                    ? "h-full max-h-full rounded-none"
                    : "max-h-[84dvh] rounded-t-[20px]",
                )
              : cn(
                  "ge-popover ge-panel rounded-xl shadow-[var(--shadow-lg)] backdrop-blur-[16px]",
                  modal
                    ? "max-h-[calc(100dvh-80px)]"
                    : "max-h-[calc(100dvh-100px)]",
                ),
          )}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onClose();
            }
          }}
        >
          {mobile && !fullscreen ? (
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
                <span className="font-mono text-[11px] font-semibold text-[var(--muted)]">
                  {meta}
                </span>
              ) : null}
            </span>
            <IconButton
              label={messages.common.close}
              size={36}
              title={`${messages.common.close} (Esc)`}
              className="text-[var(--muted)] hover:text-[var(--text)]"
              onClick={onClose}
            >
              <X className="size-4" />
            </IconButton>
          </div>
          <div
            className={cn(
              "ge-scrollbar flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-4 pt-3.5 pb-4",
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
