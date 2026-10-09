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
import { Button, IconButton, Kbd, focusRing } from "../primitives";
import type { ThemeMode } from "../theme/theme";
import { editorModes } from "./editor-chrome-state";
import { RangeSelectionMenu } from "./RangeSelectionMenu";
import { useShortcutPlatform } from "../hooks/shortcut-platform";

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
const TOP_BAR_HEIGHT = "h-[52px]";

const floating =
  "ge-panel pointer-events-auto flex items-center rounded-[14px] backdrop-blur-[16px]";

/**
 * Top row of the desktop chrome. A three-column grid keeps the brand pill,
 * toolbar, and right rail from ever overlapping: the outer columns never
 * shrink below their content, so the toolbar is centered when there is room
 * and simply shifts when there is not.
 */
export function DesktopTopRow({
  onOpenStarter,
  wide,
  ...props
}: ToolbarSharedProps &
  ThemeProps & { onOpenStarter: () => void; wide: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-4 top-4 z-[70] grid items-start gap-3",
        // Symmetric columns keep the toolbar centred when there is room; compact
        // widths let the toolbar float between the brand pill and the rail.
        wide
          ? "grid-cols-[1fr_auto_1fr]"
          : "grid-cols-[auto_minmax(0,1fr)_auto]",
      )}
    >
      <BrandPill
        mobile={false}
        open={props.panel === "app"}
        wide={wide}
        onClick={() => props.onTogglePanel("app")}
      />
      <DesktopToolbar {...props} wide={wide} />
      <DesktopRightRail {...props} wide={wide} onOpenStarter={onOpenStarter} />
    </div>
  );
}

export function MobileTopRow({
  onOpenStarter,
  ...props
}: Pick<ToolbarSharedProps, "panel" | "onTogglePanel"> &
  ThemeProps & { onOpenStarter: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-[70] flex items-start justify-between gap-3">
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
        "gap-2 justify-self-start pr-3 pl-2.5 text-[var(--text)] transition-colors hover:border-[var(--faint)]",
        TOP_BAR_HEIGHT,
        open && "border-[var(--accent)]",
      )}
    >
      <BrandLogo size={22} />
      {wide || mobile ? (
        <span
          translate="no"
          className="text-sm font-bold whitespace-nowrap @max-[599px]/editor:hidden"
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
    "h-10 text-control",
    wide ? "gap-2 pr-2.5 pl-3" : "gap-1.5 px-2.5",
  );

  return (
    <div
      role="toolbar"
      aria-label={messages.chrome.toolbar}
      data-editor-chrome-control="true"
      className={cn(
        floating,
        TOP_BAR_HEIGHT,
        "gap-0.5 justify-self-center px-1.5 backdrop-blur-[24px]",
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
              itemMode === "select" && showRangeMenu && "rounded-r-none pr-1",
            )}
            onClick={() => onModeChange(itemMode)}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className={wide ? undefined : "@max-[959px]/editor:hidden"}>
              {messages.toolbar.modes[itemMode].label}
            </span>
            {wide ? <Kbd>{keyHint}</Kbd> : null}
          </Button>
          {itemMode === "select" ? (
            <RangeSelectionMenu onOpen={() => onModeChange("select")} />
          ) : null}
        </div>
      ))}
      <Divider />
      <IconButton
        data-graph-shortcut-target="true"
        disabled={!canUndo}
        label={messages.toolbar.undo.label}
        tooltip={withShortcut(messages.toolbar.undo.tooltip, undoShortcut)}
        onClick={onUndo}
      >
        <Undo2 className="size-4" aria-hidden="true" />
      </IconButton>
      <IconButton
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
        {messages.chrome.layouts}
        <Chevron />
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
        {messages.chrome.settings}
        <Chevron />
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
        "gap-0.5 justify-self-end px-1.5",
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
      className={cn(floating, TOP_BAR_HEIGHT, "gap-0.5 px-1")}
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
          data-editor-panel-trigger={target}
          data-graph-shortcut-target="true"
          className="h-11 min-w-11 flex-col gap-1"
          style={{ paddingInline: 6 }}
          onClick={onClick}
        >
          <Icon className="size-4" aria-hidden="true" />
          <span className="text-[10px] leading-none">{text}</span>
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
  const showRangeMenu = useShortcutPlatform() !== "touch";

  return (
    <div
      role="toolbar"
      aria-label={messages.chrome.toolbar}
      data-editor-chrome-control="true"
      className={cn(
        floating,
        "absolute right-3 bottom-4 left-3 z-[70] h-[var(--ge-mobile-toolbar-height,64px)] gap-0.5 rounded-2xl px-1.5 backdrop-blur-[24px] @max-[375px]/editor:grid @max-[375px]/editor:grid-cols-3 @max-[375px]/editor:grid-rows-2 @max-[375px]/editor:py-1.5",
      )}
    >
      {editorModes.map(({ mode: itemMode, icon: Icon }) => (
        <div
          key={itemMode}
          className={cn(
            "flex min-w-11 flex-1 items-center rounded-lg",
            itemMode === "select" && showRangeMenu && "min-w-[68px]",
          )}
        >
          <MobileBarButton
            active={mode === itemMode}
            label={messages.toolbar.modes[itemMode].label}
            pressed={mode === itemMode}
            joined={itemMode === "select" && showRangeMenu}
            wide
            onClick={() => onModeChange(itemMode)}
          >
            <Icon className="size-icon-lg" aria-hidden="true" />
            <span className="text-meta leading-none">
              {messages.toolbar.modes[itemMode].label}
            </span>
          </MobileBarButton>
          {itemMode === "select" ? (
            <RangeSelectionMenu above onOpen={() => onModeChange("select")} />
          ) : null}
        </div>
      ))}
      <Divider tall />
      <MobileBarButton
        disabled={!canUndo}
        label={messages.toolbar.undo.label}
        onClick={onUndo}
      >
        <Undo2 className="size-icon-lg" aria-hidden="true" />
      </MobileBarButton>
      <MobileBarButton
        disabled={!canRedo}
        label={messages.toolbar.redo.label}
        onClick={onRedo}
      >
        <Redo2 className="size-icon-lg" aria-hidden="true" />
      </MobileBarButton>
      <Divider tall />
      <MobileBarButton
        active={panel === "menu"}
        expanded={panel === "menu"}
        label={messages.chrome.menu}
        panelTrigger="menu"
        onClick={() => onTogglePanel("menu")}
      >
        <SlidersHorizontal className="size-icon-lg" aria-hidden="true" />
      </MobileBarButton>
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
        "text-control h-10 gap-[7px]",
        wide ? "pr-3 pl-2.5" : "w-10 px-0",
      )}
      onClick={onClick}
    >
      <Icon className="size-4" aria-hidden="true" />
      {wide ? (shortLabel ?? label) : null}
    </Button>
  );
}

function MobileBarButton({
  active = false,
  children,
  disabled,
  expanded,
  label,
  pressed,
  panelTrigger,
  joined = false,
  wide = false,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  expanded?: boolean;
  label: string;
  pressed?: boolean;
  panelTrigger?: EditorPanel;
  joined?: boolean;
  wide?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      active={active}
      aria-expanded={expanded}
      aria-label={label}
      data-editor-panel-trigger={panelTrigger}
      aria-pressed={pressed}
      data-graph-shortcut-target="true"
      disabled={disabled}
      className={cn(
        "touch:h-[52px] h-[52px] flex-col gap-[3px] rounded-lg px-0",
        joined && "touch:pr-0 rounded-r-none",
        wide ? "min-w-11 flex-1" : "w-11 @max-[375px]/editor:w-full",
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Chevron() {
  return (
    <ChevronDown
      className="size-[13px] text-[var(--faint)]"
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
        tall ? "mx-0.5 h-7 w-px @max-[375px]/editor:hidden" : "mx-1.5 h-6 w-px",
      )}
    />
  );
}

function withShortcut(label: string, shortcut?: string) {
  return shortcut ? `${label} (${shortcut})` : label;
}
