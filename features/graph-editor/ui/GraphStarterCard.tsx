"use client";

import { ExternalLink, Plus, X } from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SVGProps,
} from "react";

import { cn } from "@/lib/utils";

import { useI18n } from "../i18n/I18nProvider";
import { useGraphStarterState } from "../workflows/starter/graph-starter-state";
import { PasteStarterPane, StarterTabButton } from "./GraphStarterPanels";
import {
  SAMPLE_CARD_LAYOUT_CLASS,
  SAMPLE_GALLERY_GRID_CLASS,
  SAMPLE_PREVIEW_FRAME_CLASS,
} from "./sample-gallery-layout";

const loadSampleGalleryPane = () =>
  import("./SampleGalleryPane").then((module) => ({
    default: module.SampleGalleryPane,
  }));

const SampleGalleryPane = lazy(loadSampleGalleryPane);
const AUTHOR_LINKS: {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName: string;
  label: string;
  meta: string;
}[] = [
  {
    href: "https://www.youtube.com/@daikusutora-dayo",
    icon: YouTubeLogo,
    iconClassName: "text-[#ff0033]",
    label: "YouTube",
    meta: "@daikusutora-dayo",
  },
  {
    href: "https://x.com/daikusutora3",
    icon: XLogo,
    iconClassName: "text-[var(--text)]",
    label: "X",
    meta: "@daikusutora3",
  },
  {
    href: "https://github.com/daikusutora3",
    icon: GitHubLogo,
    iconClassName: "text-[var(--text)]",
    label: "GitHub",
    meta: "daikusutora3",
  },
];

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
  const [authorMenuOpen, setAuthorMenuOpen] = useState(false);
  const { messages } = useI18n();
  const starter = useGraphStarterState({ textareaRef });
  const {
    applyText,
    close,
    handlePaste,
    inputText,
    issues,
    open,
    openPaste,
    preview,
    setInput,
    setTab,
    tab,
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

      setAuthorMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAuthorMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeAuthorMenu);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", closeAuthorMenu);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [authorMenuOpen]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 right-[calc(var(--app-space-3)+3.5rem+var(--app-space-5))] z-50 grid place-items-center px-[var(--app-space-5)] py-[var(--app-space-6)] transition-[left,right] duration-[var(--app-duration-base)] ease-[var(--app-ease)] motion-reduce:transition-none",
        sidebarCollapsed
          ? "left-[calc(var(--app-space-3)+3.5rem+var(--app-space-5))]"
          : "left-[calc(var(--app-space-3)+var(--app-toolbar-width)+var(--app-space-5))]",
      )}
    >
      {!open ? (
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
                by{" "}
                <button
                  type="button"
                  aria-expanded={authorMenuOpen}
                  aria-haspopup="menu"
                  className="pointer-events-auto rounded-[var(--app-radius-sm)] text-[var(--text-dim)] underline-offset-2 transition-colors hover:text-[var(--text)] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none"
                  onClick={() => setAuthorMenuOpen((current) => !current)}
                >
                  daikusutora
                </button>
                {authorMenuOpen ? <AuthorProfileMenu /> : null}
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
          className="gv-starter-dialog pointer-events-auto flex w-[min(560px,calc(100vw-2rem))] max-w-full flex-col overflow-hidden"
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
                inputText={inputText}
                issues={issues}
                previewFormat={preview?.format}
                textareaRef={textareaRef}
                onInputTextChange={setInput}
                onPaste={handlePaste}
                onApply={() => applyText()}
              />
            ) : null}

            {tab === "sample" ? (
              <Suspense fallback={<SampleGalleryFallback />}>
                <SampleGalleryPane
                  onSampleApplied={(edgeList) => {
                    setInput(edgeList);
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

function AuthorProfileMenu() {
  return (
    <div
      role="menu"
      aria-label="Profile links"
      className="gv-popover pointer-events-auto absolute top-[calc(100%+0.5rem)] left-1/2 z-[100] flex w-56 -translate-x-1/2 flex-col gap-1 p-1.5 text-left"
    >
      {AUTHOR_LINKS.map(({ href, icon: Icon, iconClassName, label, meta }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noreferrer"
          role="menuitem"
          className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--app-radius-md)] px-2 py-1.5 text-[var(--text-dim)] transition-colors hover:bg-[var(--state-hover-bg)] hover:text-[var(--state-hover-text)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none"
        >
          <span className="grid size-7 place-items-center rounded-[var(--app-radius-sm)] bg-[var(--state-control-bg)]">
            <Icon className={cn("size-4", iconClassName)} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[length:var(--app-text-xs)] leading-none font-bold">
              {label}
            </span>
            <span className="truncate text-[0.6875rem] leading-none font-medium text-[var(--text-mute)]">
              {meta}
            </span>
          </span>
          <ExternalLink className="size-3.5 text-[var(--text-mute)]" />
        </a>
      ))}
    </div>
  );
}

function YouTubeLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        fill="currentColor"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z"
      />
      <path fill="var(--surface)" d="M9.6 15.5v-7l6.2 3.5-6.2 3.5Z" />
    </svg>
  );
}

function XLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
    </svg>
  );
}

function GitHubLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.85 10.91.57.11.78-.25.78-.55v-2.02c-3.19.69-3.86-1.37-3.86-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18A11 11 0 0 1 12 6.19c.98 0 1.96.13 2.88.39 2.19-1.49 3.15-1.18 3.15-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.82 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.03c0 .3.21.67.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
      />
    </svg>
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
