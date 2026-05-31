"use client";

import { Plus, X } from "lucide-react";
import { lazy, Suspense, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import { useI18n } from "../i18n/I18nProvider";
import { useGraphStarterState } from "../workflows/starter/graph-starter-state";
import { AuthorProfileMenu } from "./AuthorProfileMenu";
import { PasteStarterPane, StarterTabButton } from "./GraphStarterPanels";
import {
  SAMPLE_CARD_LAYOUT_CLASS,
  SAMPLE_GALLERY_GRID_CLASS,
  SAMPLE_PREVIEW_FRAME_CLASS,
} from "./sample-gallery-layout";
import { useAnimatedNullableState } from "./use-panel-presence";

const loadSampleGalleryPane = () =>
  import("./SampleGalleryPane").then((module) => ({
    default: module.SampleGalleryPane,
  }));

const SampleGalleryPane = lazy(loadSampleGalleryPane);

type GraphStarterCardProps = {
  visible: boolean;
  sidebarCollapsed: boolean;
};

export function GraphStarterCard({
  visible,
  sidebarCollapsed,
}: GraphStarterCardProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const authorMenuRef = useRef<HTMLSpanElement | null>(null);
  const {
    openValue: authorMenuValue,
    panelPresence: authorMenuPresence,
    setValue: setAuthorMenuValue,
  } = useAnimatedNullableState<"author-menu">();
  const authorMenuOpen = authorMenuValue !== null;
  const { messages } = useI18n();
  const starter = useGraphStarterState({ textareaRef });
  const {
    applyText,
    close,
    importFormat,
    inputText,
    open,
    panelPresence: starterDialogPresence,
    openPaste,
    preview,
    setImportFormat,
    setInput,
    setTab,
    tab,
    visibleIssues,
  } = starter;

  useEffect(() => {
    if (open) {
      void loadSampleGalleryPane();
    }
  }, [open]);

  useEffect(() => {
    if (!authorMenuOpen) {
      return;
    }

    const closeAuthorMenu = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        authorMenuRef.current?.contains(event.target)
      ) {
        return;
      }

      setAuthorMenuValue(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAuthorMenuValue(null);
      }
    };

    document.addEventListener("mousedown", closeAuthorMenu);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", closeAuthorMenu);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [authorMenuOpen, setAuthorMenuValue]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 right-[calc(var(--app-space-3)+3.5rem+var(--app-space-2))] z-50 grid place-items-center px-[var(--app-space-3)] py-[var(--app-space-6)] transition-[left,right] duration-[var(--app-duration-base)] ease-[var(--app-ease)] motion-reduce:transition-none",
        sidebarCollapsed
          ? "left-[calc(var(--app-space-3)+3.5rem+var(--app-space-2))]"
          : "left-[calc(var(--app-space-3)+var(--app-toolbar-width)+var(--app-space-2))]",
      )}
    >
      {!starterDialogPresence.mounted ? (
        <div className="gv-empty-start flex w-[min(24rem,calc(100vw-3rem))] -translate-y-[1vh] flex-col items-center gap-[var(--app-space-5)] text-center">
          <div className="flex min-w-0 flex-col items-center gap-3">
            <span className="relative grid size-26 shrink-0 place-items-center">
              <img
                src="/brand/graph-editor-logo.webp"
                alt=""
                aria-hidden="true"
                width={104}
                height={104}
                className="brand-logo-image-light size-26 object-contain select-none"
                draggable={false}
              />
              <img
                src="/brand/graph-editor-logo-dark.webp"
                alt=""
                aria-hidden="true"
                width={104}
                height={104}
                className="brand-logo-image-dark size-26 object-contain select-none"
                draggable={false}
              />
            </span>
            <span className="flex min-w-0 flex-col items-center gap-1">
              <span
                translate="no"
                className="max-w-full truncate [font-family:var(--app-font-display)] text-[1.75rem] leading-[var(--app-leading-tight)] font-bold text-[var(--text)]"
              >
                {messages.app.title}
              </span>
              <span
                ref={authorMenuRef}
                className="relative inline-block max-w-full text-[length:var(--app-text-xs)] leading-[var(--app-leading-tight)] font-medium text-[var(--text-mute)]"
              >
                {messages.app.authorPrefix}{" "}
                <button
                  type="button"
                  aria-expanded={authorMenuOpen}
                  aria-haspopup="menu"
                  className="pointer-events-auto rounded-[var(--app-radius-sm)] text-[var(--text-mute)] underline-offset-2 transition-colors hover:text-[var(--text)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none"
                  onClick={() =>
                    setAuthorMenuValue(authorMenuOpen ? null : "author-menu")
                  }
                >
                  daikusutora
                </button>
                {authorMenuPresence.mounted ? (
                  <AuthorProfileMenu panelState={authorMenuPresence.state} />
                ) : null}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={openPaste}
            className="gv-control pointer-events-auto h-10 w-fit max-w-full justify-center gap-[var(--app-space-2)] self-center px-[var(--app-space-4)] font-semibold"
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <Plus
              className="size-4 shrink-0 text-[var(--text-dim)]"
              aria-hidden="true"
            />
            <span className="min-w-0 truncate">
              {messages.starter.createGraph}
            </span>
          </button>
        </div>
      ) : (
        <section
          role="dialog"
          aria-modal="false"
          aria-label={messages.starter.dialogLabel}
          data-panel-state={starterDialogPresence.state}
          className="gv-starter-dialog pointer-events-auto flex w-full max-w-[680px] min-w-0 flex-col overflow-hidden"
        >
          <div className="grid grid-cols-[1fr_auto] items-center gap-[var(--app-space-2)] px-[var(--app-space-3)] pt-[var(--app-space-2)] pb-[var(--app-space-2)]">
            <div
              role="tablist"
              aria-label={messages.starter.methodLabel}
              className="gv-starter-tabs min-w-0"
            >
              <StarterTabButton
                tab="paste"
                current={tab}
                label={messages.starter.paste}
                onClick={setTab}
              />
              <StarterTabButton
                tab="sample"
                current={tab}
                label={messages.starter.sample}
                onClick={setTab}
              />
            </div>
            <button
              type="button"
              aria-label={messages.common.close}
              title={`${messages.common.close} (Esc)`}
              onClick={close}
              className="gv-icon-button size-8 bg-transparent"
            >
              <X className="size-4" />
            </button>
          </div>

          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden",
              tab === "sample"
                ? "relative flex flex-col"
                : "px-[var(--app-space-3)] pt-[var(--app-space-2)] pb-[var(--app-space-3)]",
            )}
          >
            {tab === "paste" ? (
              <PasteStarterPane
                importFormat={importFormat}
                inputText={inputText}
                issues={visibleIssues}
                previewFormat={preview?.format}
                previewModel={preview?.model}
                textareaRef={textareaRef}
                onImportFormatChange={setImportFormat}
                onInputTextChange={setInput}
                onApply={() => applyText()}
              />
            ) : null}

            {tab === "sample" ? (
              <Suspense fallback={<SampleGalleryFallback />}>
                <SampleGalleryPane
                  onSampleApplied={() => {
                    close();
                  }}
                />
              </Suspense>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}

function SampleGalleryFallback() {
  const { messages } = useI18n();

  return (
    <div
      className="gv-sample-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-center gap-[var(--app-space-2)] px-[var(--app-space-3)] pt-[var(--app-space-2)] pb-[var(--app-space-3)]">
        <div className="gv-skeleton h-8 min-w-[200px] flex-[1_1_220px] rounded-[var(--app-radius-sm)]" />
        <div className="gv-skeleton h-4 w-14 rounded-[var(--app-radius-pill)]" />
      </div>
      <div className="gv-scrollbar flex min-h-0 flex-1 flex-col gap-[14px] overflow-hidden px-[var(--app-space-3)] pt-[var(--app-space-2)] pb-[var(--app-space-3)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-[var(--app-space-3)] px-1">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="gv-skeleton h-3 w-28 rounded-[var(--app-radius-pill)]" />
            <div className="gv-skeleton h-3 w-44 rounded-[var(--app-radius-pill)]" />
          </div>
          <div className="gv-skeleton h-3 w-5 rounded-[var(--app-radius-pill)]" />
        </div>
        <div className={SAMPLE_GALLERY_GRID_CLASS}>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className={`${SAMPLE_CARD_LAYOUT_CLASS} border border-[var(--divider)] bg-[var(--bg-deep)]`}
            >
              <div className={`${SAMPLE_PREVIEW_FRAME_CLASS} gv-skeleton`} />
              <div className="flex min-w-0 flex-col gap-2">
                <div className="gv-skeleton h-4 w-24 rounded-[var(--app-radius-pill)]" />
                <div className="gv-skeleton h-3 w-32 rounded-[var(--app-radius-pill)]" />
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">{messages.starter.loadingSamples}</span>
      </div>
    </div>
  );
}
