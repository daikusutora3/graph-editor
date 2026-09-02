"use client";

import {
  Camera,
  ChevronDown,
  Download,
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

const floating =
  "ge-panel absolute z-[70] flex items-center rounded-xl backdrop-blur-[16px]";

export function BrandPill({
  mobile,
  onClick,
  wide,
}: {
  mobile: boolean;
  onClick: () => void;
  wide: boolean;
}) {
  const { messages } = useI18n();

  return (
    <button
      type="button"
      data-editor-chrome-control="true"
      aria-label={messages.chrome.openStarter}
      title={messages.chrome.openStarter}
      onClick={onClick}
      className={cn(
        floating,
        focusRing,
        "h-11 gap-2 pr-3 pl-2.5 text-[var(--text)] transition-colors hover:border-[var(--faint)]",
        mobile ? "top-3 left-3" : "top-4 left-4",
      )}
    >
      <BrandLogo size={22} />
      {wide || mobile ? (
        <span translate="no" className="text-sm font-bold whitespace-nowrap">
          {messages.app.title}
        </span>
      ) : null}
      {!mobile ? (
        <ChevronDown
          className="size-[13px] text-[var(--muted)]"
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
}

export function DesktopToolbar({
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
  const modeButtonClass = cn(
    "h-10 text-[13.5px]",
    wide ? "gap-2 pr-2.5 pl-3" : "gap-1.5 px-2.5",
  );

  return (
    <div
      role="toolbar"
      aria-label={messages.chrome.toolbar}
      data-editor-chrome-control="true"
      className={cn(
        floating,
        "top-4 left-1/2 h-[52px] -translate-x-1/2 gap-0.5 rounded-[14px] px-1.5 backdrop-blur-[24px]",
      )}
    >
      {editorModes.map(({ mode: itemMode, keyHint, icon: Icon }) => (
        <Button
          key={itemMode}
          active={mode === itemMode}
          aria-label={messages.toolbar.modes[itemMode].label}
          aria-pressed={mode === itemMode}
          data-graph-shortcut-target="true"
          title={`${messages.toolbar.modes[itemMode].tooltip} (${keyHint})`}
          className={modeButtonClass}
          onClick={() => onModeChange(itemMode)}
        >
          <Icon className="size-4" aria-hidden="true" />
          {messages.toolbar.modes[itemMode].label}
          {wide ? <Kbd>{keyHint}</Kbd> : null}
        </Button>
      ))}
      <Divider />
      <IconButton
        data-graph-shortcut-target="true"
        disabled={!canUndo}
        label={messages.toolbar.undo.label}
        title={withShortcut(messages.toolbar.undo.tooltip, undoShortcut)}
        onClick={onUndo}
      >
        <Undo2 className="size-4" aria-hidden="true" />
      </IconButton>
      <IconButton
        data-graph-shortcut-target="true"
        disabled={!canRedo}
        label={messages.toolbar.redo.label}
        title={withShortcut(messages.toolbar.redo.tooltip, redoShortcut)}
        onClick={onRedo}
      >
        <Redo2 className="size-4" aria-hidden="true" />
      </IconButton>
      <Divider />
      <Button
        active={panel === "layouts"}
        aria-expanded={panel === "layouts"}
        aria-label={messages.chrome.layouts}
        data-graph-shortcut-target="true"
        title={`${messages.chrome.layouts} (L)`}
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
        data-graph-shortcut-target="true"
        title={`${messages.chrome.settings} (,)`}
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

export function DesktopRightRail({
  panel,
  theme,
  wide,
  onToggleTheme,
  onTogglePanel,
}: {
  panel: EditorPanel | null;
  theme: ThemeMode;
  wide: boolean;
  onToggleTheme: () => void;
  onTogglePanel: (panel: EditorPanel) => void;
}) {
  const { messages } = useI18n();

  return (
    <div
      data-editor-chrome-control="true"
      className={cn(floating, "top-4 right-4 h-11 gap-0.5 px-[3px]")}
    >
      <ThemeButton theme={theme} onClick={onToggleTheme} />
      <span
        aria-hidden="true"
        className="mx-[3px] h-[22px] w-px bg-[var(--line)]"
      />
      <RailButton
        active={panel === "export"}
        icon={Download}
        label={messages.chrome.export}
        wide={wide}
        onClick={() => onTogglePanel("export")}
      />
      <RailButton
        active={panel === "png"}
        icon={Camera}
        label={messages.chrome.png}
        shortLabel={messages.chrome.pngShort}
        wide={wide}
        onClick={() => onTogglePanel("png")}
      />
    </div>
  );
}

export function MobileTopRail({
  panel,
  theme,
  onToggleTheme,
  onTogglePanel,
}: {
  panel: EditorPanel | null;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onTogglePanel: (panel: EditorPanel) => void;
}) {
  const { messages } = useI18n();

  return (
    <div
      data-editor-chrome-control="true"
      className={cn(floating, "top-3 right-3 h-11 gap-0.5 px-[3px]")}
    >
      <ThemeButton theme={theme} iconSize={17} onClick={onToggleTheme} />
      <IconButton
        active={panel === "export"}
        aria-expanded={panel === "export"}
        data-graph-shortcut-target="true"
        label={messages.chrome.export}
        size={38}
        onClick={() => onTogglePanel("export")}
      >
        <Download className="size-[17px]" aria-hidden="true" />
      </IconButton>
      <IconButton
        active={panel === "png"}
        aria-expanded={panel === "png"}
        data-graph-shortcut-target="true"
        label={messages.chrome.png}
        size={38}
        onClick={() => onTogglePanel("png")}
      >
        <Camera className="size-[17px]" aria-hidden="true" />
      </IconButton>
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

  return (
    <div
      role="toolbar"
      aria-label={messages.chrome.toolbar}
      data-editor-chrome-control="true"
      className={cn(
        floating,
        "right-3 bottom-4 left-3 h-16 gap-0.5 rounded-2xl px-1.5 backdrop-blur-[24px]",
      )}
    >
      {editorModes.map(({ mode: itemMode, icon: Icon }) => (
        <MobileBarButton
          key={itemMode}
          active={mode === itemMode}
          label={messages.toolbar.modes[itemMode].label}
          pressed={mode === itemMode}
          wide
          onClick={() => onModeChange(itemMode)}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
          <span className="text-[10.5px] leading-none">
            {messages.toolbar.modes[itemMode].label}
          </span>
        </MobileBarButton>
      ))}
      <Divider tall />
      <MobileBarButton
        disabled={!canUndo}
        label={messages.toolbar.undo.label}
        onClick={onUndo}
      >
        <Undo2 className="size-[18px]" aria-hidden="true" />
      </MobileBarButton>
      <MobileBarButton
        disabled={!canRedo}
        label={messages.toolbar.redo.label}
        onClick={onRedo}
      >
        <Redo2 className="size-[18px]" aria-hidden="true" />
      </MobileBarButton>
      <Divider tall />
      <MobileBarButton
        active={panel === "menu"}
        expanded={panel === "menu"}
        label={messages.chrome.menu}
        onClick={() => onTogglePanel("menu")}
      >
        <SlidersHorizontal className="size-[18px]" aria-hidden="true" />
      </MobileBarButton>
    </div>
  );
}

function ThemeButton({
  iconSize = 16,
  theme,
  onClick,
}: {
  iconSize?: number;
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
      size={38}
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
  shortLabel,
  wide,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  shortLabel?: string;
  wide: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      active={active}
      aria-expanded={active}
      aria-label={label}
      data-graph-shortcut-target="true"
      title={label}
      className={cn(
        "h-[38px] gap-[7px]",
        wide ? "pr-3 pl-2.5" : "w-[38px] px-0",
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
  wide = false,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  expanded?: boolean;
  label: string;
  pressed?: boolean;
  wide?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      active={active}
      aria-expanded={expanded}
      aria-label={label}
      aria-pressed={pressed}
      data-graph-shortcut-target="true"
      disabled={disabled}
      className={cn(
        "h-[52px] flex-col gap-[3px] rounded-[10px] px-0",
        wide ? "min-w-0 flex-1" : "w-[46px]",
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
        tall ? "mx-1 h-7 w-px" : "mx-1.5 h-6 w-px",
      )}
    />
  );
}

function withShortcut(label: string, shortcut?: string) {
  return shortcut ? `${label} (${shortcut})` : label;
}
