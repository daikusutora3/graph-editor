"use client";

import {
  Camera,
  ChevronDown,
  Download,
  FileInput,
  LayoutGrid,
  Moon,
  Redo2,
  SlidersHorizontal,
  Sun,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { useI18n } from "../../i18n/I18nProvider";
import type { EditorPanel } from "../../shell/state/editor-layout";
import type { EditorMode } from "../../shell/state/editor-state";
import { BrandLogo } from "../brand/BrandLogo";
import {
  Button,
  IconButton,
  Kbd,
  focusRing,
  pressFeedback,
} from "@/components/ui/controls";
import type { ThemeMode } from "../theme/theme";
import { editorModes } from "./editor-chrome-state";
import { RangeSelectionMenu } from "./RangeSelectionMenu";
import { useShortcutPlatform } from "../hooks/shortcut-platform";
import { useEditorChromeBounds } from "./editor-chrome-bounds";

type ToolbarSharedProps = {
  canRedo: boolean;
  canUndo: boolean;
  mode: EditorMode;
  panel: EditorPanel | null;
  redoShortcut?: string;
  undoShortcut?: string;
  onModeChange: (mode: EditorMode) => void;
  onRedo: () => void;
  onTogglePanel: (panel: EditorPanel) => void;
  onUndo: () => void;
};

type ThemeProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

/** Every bar in the top row shares this height so they read as one group. */
const TOP_BAR_HEIGHT = "min-h-[3.375rem] py-1";
const TOOLBAR_LABEL = "hidden @min-[40rem]/top-toolbar:inline";

const floating =
  "ge-panel pointer-events-auto flex items-center rounded-[14px] backdrop-blur-[16px]";

/**
 * Top row of the desktop chrome. A three-column grid keeps the brand pill,
 * toolbar, and right rail from overlapping. The toolbar uses the remaining
 * width and omits labels and key hints before its controls could wrap.
 */
export function DesktopTopRow({
  onOpenStarter,
  wide,
  ...props
}: ToolbarSharedProps &
  ThemeProps & { onOpenStarter: () => void; wide: boolean }) {
  const boundsRef = useEditorChromeBounds("top");
  return (
    <div
      ref={boundsRef}
      data-editor-chrome-top
      className={cn(
        "pointer-events-none absolute inset-x-[16px] top-[16px] z-[70] grid items-start gap-[12px]",
        "grid-cols-[auto_minmax(0,1fr)_auto]",
      )}
    >
      <BrandPill
        mobile={false}
        open={props.panel === "app"}
        wide={wide}
        onClick={() => props.onTogglePanel("app")}
      />
      <div className="@container/top-toolbar flex min-w-0 justify-center">
        <DesktopToolbar {...props} wide={wide} />
      </div>
      <DesktopRightRail {...props} wide={wide} onOpenStarter={onOpenStarter} />
    </div>
  );
}

export function MobileTopRow({
  onOpenStarter,
  ...props
}: Pick<ToolbarSharedProps, "panel" | "onTogglePanel"> &
  ThemeProps & { onOpenStarter: () => void }) {
  const boundsRef = useEditorChromeBounds("top");
  return (
    <div
      ref={boundsRef}
      data-editor-chrome-top
      className="pointer-events-none absolute inset-x-[12px] top-3 z-[70] flex flex-wrap items-start justify-between gap-[12px]"
    >
      <BrandPill
        mobile
        open={props.panel === "app"}
        wide={false}
        onClick={() => props.onTogglePanel("app")}
      />
      <MobileTopRail {...props} onOpenStarter={onOpenStarter} />
    </div>
  );
}

function BrandPill({
  mobile,
  open,
  onClick,
  wide,
}: {
  mobile: boolean;
  open: boolean;
  onClick: () => void;
  wide: boolean;
}) {
  const { messages } = useI18n();

  return (
    <button
      type="button"
      data-editor-chrome-control="true"
      data-editor-panel-trigger="app"
      aria-label={messages.appMenu.open}
      aria-expanded={open}
      aria-haspopup="menu"
      data-tooltip={messages.appMenu.label}
      onClick={onClick}
      className={cn(
        floating,
        focusRing,
        pressFeedback,
        "gap-[8px] justify-self-start pr-[12px] pl-[10px] text-[var(--text)] transition-colors hover:border-[var(--faint)]",
        TOP_BAR_HEIGHT,
        open && "border-[var(--accent)]",
      )}
    >
      <BrandLogo size={22} />
      {wide || mobile ? (
        <span
          translate="no"
          className={cn(
            "text-sm font-bold whitespace-nowrap",
            wide ? "@max-[76rem]/editor:hidden" : "@max-[599px]/editor:hidden",
          )}
        >
          {messages.app.title}
        </span>
      ) : null}
      <ChevronDown
        className={cn(
          "size-[13px] text-[var(--muted)] transition-transform",
          open && "rotate-180",
        )}
        aria-hidden="true"
      />
    </button>
  );
}

function DesktopToolbar({
  canRedo,
  canUndo,
  mode,
  panel,
  redoShortcut,
  undoShortcut,
  wide,
  onModeChange,
  onRedo,
  onTogglePanel,
  onUndo,
}: ToolbarSharedProps & { wide: boolean }) {
  const { messages } = useI18n();
  const showRangeMenu = useShortcutPlatform() !== "touch";
  const modeButtonClass = cn(
    "h-11 w-[44px] min-w-[44px] px-0 text-control @min-[40rem]/top-toolbar:w-auto touch:px-0",
    wide
      ? "@min-[40rem]/top-toolbar:gap-2 @min-[40rem]/top-toolbar:pr-2.5 @min-[40rem]/top-toolbar:pl-3"
      : "@min-[40rem]/top-toolbar:gap-1.5 @min-[40rem]/top-toolbar:px-2.5",
  );

  return (
    <div
      role="toolbar"
      aria-label={messages.chrome.toolbar}
      data-editor-chrome-control="true"
      className={cn(
        floating,
        TOP_BAR_HEIGHT,
        "max-w-full flex-nowrap gap-[2px] px-[6px] backdrop-blur-[24px] [&_[data-range-selection-trigger]]:w-[24px] [&_[data-range-selection-trigger]_svg]:size-[14px]",
      )}
    >
      {editorModes.map(({ mode: itemMode, keyHint, icon: Icon }) => (
        <div key={itemMode} className="flex items-center">
          <Button
            active={mode === itemMode}
            aria-label={messages.toolbar.modes[itemMode].label}
            aria-pressed={mode === itemMode}
            data-graph-shortcut-target="true"
            tooltip={`${messages.toolbar.modes[itemMode].tooltip} (${keyHint})`}
            className={cn(
              modeButtonClass,
              itemMode === "select" &&
                showRangeMenu &&
                "rounded-r-none @min-[40rem]/top-toolbar:pr-1",
            )}
            onClick={() => onModeChange(itemMode)}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className={TOOLBAR_LABEL}>
              {messages.toolbar.modes[itemMode].label}
            </span>
            {wide ? (
              <span className="hidden @min-[48rem]/top-toolbar:inline-flex">
                <Kbd>{keyHint}</Kbd>
              </span>
            ) : null}
          </Button>
          {itemMode === "select" ? (
            <RangeSelectionMenu onOpen={() => onModeChange("select")} />
          ) : null}
        </div>
      ))}
      <Divider />
      <IconButton
        className="h-11 w-[44px] touch:w-[44px]"
        data-graph-shortcut-target="true"
        disabled={!canUndo}
        label={messages.toolbar.undo.label}
        tooltip={withShortcut(messages.toolbar.undo.tooltip, undoShortcut)}
        onClick={onUndo}
      >
        <Undo2 className="size-4" aria-hidden="true" />
      </IconButton>
      <IconButton
        className="h-11 w-[44px] touch:w-[44px]"
        data-graph-shortcut-target="true"
        disabled={!canRedo}
        label={messages.toolbar.redo.label}
        tooltip={withShortcut(messages.toolbar.redo.tooltip, redoShortcut)}
        onClick={onRedo}
      >
        <Redo2 className="size-4" aria-hidden="true" />
      </IconButton>
      <Divider />
      <Button
        active={panel === "layouts"}
        aria-expanded={panel === "layouts"}
        aria-label={messages.chrome.layouts}
        data-editor-panel-trigger="layouts"
        data-graph-shortcut-target="true"
        tooltip={`${messages.chrome.layouts} (L)`}
        className={modeButtonClass}
        onClick={() => onTogglePanel("layouts")}
      >
        <LayoutGrid className="size-4" aria-hidden="true" />
        <span className={TOOLBAR_LABEL}>{messages.chrome.layouts}</span>
        <Chevron className={TOOLBAR_LABEL} />
      </Button>
      <Button
        active={panel === "settings"}
        aria-expanded={panel === "settings"}
        aria-label={messages.chrome.settings}
        data-editor-panel-trigger="settings"
        data-graph-shortcut-target="true"
        tooltip={`${messages.chrome.settings} (,)`}
        className={modeButtonClass}
        onClick={() => onTogglePanel("settings")}
      >
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        <span className={TOOLBAR_LABEL}>{messages.chrome.settings}</span>
        <Chevron className={TOOLBAR_LABEL} />
      </Button>
    </div>
  );
}

function DesktopRightRail({
  panel,
  theme,
  wide,
  onOpenStarter,
  onToggleTheme,
  onTogglePanel,
}: Pick<ToolbarSharedProps, "panel" | "onTogglePanel"> &
  ThemeProps & { onOpenStarter: () => void; wide: boolean }) {
  const { messages } = useI18n();

  return (
    <div
      data-editor-chrome-control="true"
      className={cn(
        floating,
        TOP_BAR_HEIGHT,
        "gap-[2px] justify-self-end px-[6px]",
      )}
    >
      <ThemeButton theme={theme} onClick={onToggleTheme} />
      <Divider />
      <RailButton
        active={panel === "starter"}
        panelTrigger="starter"
        icon={FileInput}
        label={messages.chrome.openStarter}
        shortLabel={messages.chrome.load}
        wide={wide}
        onClick={onOpenStarter}
      />
      <RailButton
        active={panel === "export"}
        panelTrigger="export"
        icon={Download}
        label={messages.chrome.export}
        wide={wide}
        onClick={() => onTogglePanel("export")}
      />
      <RailButton
        active={panel === "png"}
        panelTrigger="png"
        icon={Camera}
        label={messages.chrome.png}
        shortLabel={messages.chrome.pngShort}
        wide={wide}
        onClick={() => onTogglePanel("png")}
      />
    </div>
  );
}

function MobileTopRail({
  panel,
  theme,
  onOpenStarter,
  onToggleTheme,
  onTogglePanel,
}: Pick<ToolbarSharedProps, "panel" | "onTogglePanel"> &
  ThemeProps & { onOpenStarter: () => void }) {
  const { messages } = useI18n();

  return (
    <div
      data-editor-chrome-control="true"
      className={cn(
        floating,
        TOP_BAR_HEIGHT,
        "max-w-full flex-nowrap gap-[2px] px-[4px]",
      )}
    >
      <ThemeButton theme={theme} iconSize={17} onClick={onToggleTheme} />
      {[
        {
          panel: "starter",
          icon: FileInput,
          label: messages.chrome.openStarter,
          text: messages.chrome.load,
          onClick: onOpenStarter,
        },
        {
          panel: "export",
          icon: Download,
          label: messages.chrome.export,
          text: messages.chrome.export,
          onClick: () => onTogglePanel("export"),
        },
        {
          panel: "png",
          icon: Camera,
          label: messages.chrome.png,
          text: messages.chrome.pngShort,
          onClick: () => onTogglePanel("png"),
        },
      ].map(({ panel: target, icon: Icon, label, text, onClick }) => (
        <Button
          key={target}
          active={panel === target}
          aria-expanded={panel === target}
          aria-label={label}
          tooltip={label}
          data-editor-panel-trigger={target}
          data-graph-shortcut-target="true"
          className="h-11 min-w-[44px] flex-col gap-1"
          style={{ paddingInline: 6 }}
          onClick={onClick}
        >
          <Icon className="size-4" aria-hidden="true" />
          <span className="text-meta leading-none @max-[18rem]/editor:hidden">
            {text}
          </span>
        </Button>
      ))}
    </div>
  );
}

export function MobileBottomBar({
  canRedo,
  canUndo,
  mode,
  panel,
  onModeChange,
  onRedo,
  onTogglePanel,
  onUndo,
}: ToolbarSharedProps) {
  const { messages } = useI18n();
  const boundsRef = useEditorChromeBounds("bottom");
  const showRangeMenu = useShortcutPlatform() !== "touch";

  return (
    <div
      ref={boundsRef}
      data-editor-chrome-bottom
      role="toolbar"
      aria-label={messages.chrome.toolbar}
      data-editor-chrome-control="true"
      className={cn(
        floating,
        "absolute bottom-4 left-1/2 z-[70] min-h-[3.375rem] w-max max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap justify-center gap-x-0 gap-y-1 rounded-2xl p-1 backdrop-blur-[24px]",
      )}
    >
      <div className="flex max-w-full flex-wrap items-center justify-center">
        {editorModes.map(({ mode: itemMode, icon: Icon }) => (
          <div key={itemMode} className="flex shrink-0 items-center rounded-xl">
            <MobileBarButton
              active={mode === itemMode}
              caption={messages.toolbar.modes[itemMode].label}
              label={messages.toolbar.modes[itemMode].label}
              pressed={mode === itemMode}
              joined={itemMode === "select" && showRangeMenu}
              onClick={() => onModeChange(itemMode)}
            >
              <Icon
                className="size-icon-lg"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </MobileBarButton>
            {itemMode === "select" ? (
              <RangeSelectionMenu above onOpen={() => onModeChange("select")} />
            ) : null}
          </div>
        ))}
      </div>
      <Divider tall />
      <div className="flex max-w-full flex-wrap items-center justify-center">
        <MobileBarButton
          disabled={!canUndo}
          label={messages.toolbar.undo.label}
          onClick={onUndo}
        >
          <Undo2
            className="size-icon-lg"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </MobileBarButton>
        <MobileBarButton
          disabled={!canRedo}
          label={messages.toolbar.redo.label}
          onClick={onRedo}
        >
          <Redo2
            className="size-icon-lg"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </MobileBarButton>
        <MobileBarButton
          active={panel === "menu"}
          expanded={panel === "menu"}
          label={messages.chrome.menu}
          panelTrigger="menu"
          onClick={() => onTogglePanel("menu")}
        >
          <SlidersHorizontal
            className="size-icon-lg"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </MobileBarButton>
      </div>
    </div>
  );
}

function ThemeButton({
  iconSize = 16,
  size = "lg",
  theme,
  onClick,
}: {
  iconSize?: number;
  size?: "sm" | "md" | "lg";
  theme: ThemeMode;
  onClick: () => void;
}) {
  const { messages } = useI18n();
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <IconButton
      className="h-11 w-[44px] touch:w-[44px]"
      data-graph-shortcut-target="true"
      label={
        theme === "dark"
          ? messages.common.switchLightMode
          : messages.common.switchDarkMode
      }
      size={size}
      tooltipSide="bottom-end"
      onClick={onClick}
    >
      <Icon style={{ width: iconSize, height: iconSize }} aria-hidden="true" />
    </IconButton>
  );
}

function RailButton({
  active,
  icon: Icon,
  label,
  panelTrigger,
  shortLabel,
  wide,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  panelTrigger: EditorPanel;
  shortLabel?: string;
  wide: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      active={active}
      aria-expanded={active}
      aria-label={label}
      data-editor-panel-trigger={panelTrigger}
      data-graph-shortcut-target="true"
      tooltip={label}
      tooltipSide="bottom-end"
      className={cn(
        "h-11 w-[44px] min-w-[44px] gap-[7px] px-0 text-control touch:px-0",
        wide &&
          "@min-[76rem]/editor:w-auto @min-[76rem]/editor:pr-3 @min-[76rem]/editor:pl-2.5",
      )}
      onClick={onClick}
    >
      <Icon className="size-4" aria-hidden="true" />
      {wide ? (
        <span className="hidden @min-[76rem]/editor:inline">
          {shortLabel ?? label}
        </span>
      ) : null}
    </Button>
  );
}

function MobileBarButton({
  active = false,
  caption,
  children,
  disabled,
  expanded,
  label,
  pressed,
  panelTrigger,
  joined = false,
  onClick,
}: {
  active?: boolean;
  caption?: string;
  children: ReactNode;
  disabled?: boolean;
  expanded?: boolean;
  label: string;
  pressed?: boolean;
  panelTrigger?: EditorPanel;
  joined?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      active={active}
      aria-expanded={expanded}
      aria-label={label}
      tooltip={label}
      tooltipSide="top"
      data-editor-panel-trigger={panelTrigger}
      aria-pressed={pressed}
      data-graph-shortcut-target="true"
      disabled={disabled}
      className={cn(
        "size-11 rounded-xl p-0 touch:p-0",
        caption && "flex-col gap-0.5",
        joined && "rounded-r-none",
      )}
      onClick={onClick}
    >
      {children}
      {caption ? <span className="text-xs leading-none">{caption}</span> : null}
    </Button>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <ChevronDown
      className={cn("size-[13px] text-[var(--faint)]", className)}
      aria-hidden="true"
    />
  );
}

function Divider({ tall = false }: { tall?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "shrink-0 bg-[var(--line)]",
        tall ? "mx-0.5 h-6 w-px" : "mx-[4px] h-6 w-px",
      )}
    />
  );
}

function withShortcut(label: string, shortcut?: string) {
  return shortcut ? `${label} (${shortcut})` : label;
}
