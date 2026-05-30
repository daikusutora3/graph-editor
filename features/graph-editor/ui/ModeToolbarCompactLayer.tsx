"use client";

import type { MouseEvent, ReactNode, Ref } from "react";
import { PanelLeft, Redo2, Trash2, Undo2 } from "lucide-react";

import { useI18n } from "../i18n/I18nProvider";
import type { EditorMode } from "../shell/state/editor-state";
import { cn } from "@/lib/utils";

import { toolbarModes } from "./mode-toolbar-options";

type CompactToolbarLayerProps = {
  clearArmed: boolean;
  compactLayerRef: Ref<HTMLDivElement>;
  compactToggleRef: Ref<HTMLButtonElement>;
  futureDisabled: boolean;
  historyDisabled: boolean;
  isGraphEmpty: boolean;
  mode: EditorMode;
  redoShortcut: string;
  sidebarCollapsed: boolean;
  undoShortcut: string;
  onClearEditor: () => void;
  onModeChange: (mode: EditorMode) => void;
  onRedo: () => void;
  onToggleCollapsed: (collapsed: boolean, restoreFocus: boolean) => void;
  onUndo: () => void;
};

export function CompactToolbarLayer({
  clearArmed,
  compactLayerRef,
  compactToggleRef,
  futureDisabled,
  historyDisabled,
  isGraphEmpty,
  mode,
  redoShortcut,
  sidebarCollapsed,
  undoShortcut,
  onClearEditor,
  onModeChange,
  onRedo,
  onToggleCollapsed,
  onUndo,
}: CompactToolbarLayerProps) {
  const { messages } = useI18n();

  return (
    <div
      ref={compactLayerRef}
      aria-hidden={!sidebarCollapsed ? true : undefined}
      inert={!sidebarCollapsed ? true : undefined}
      className={cn(
        "flex flex-col items-center gap-1 rounded-[inherit] px-1 pt-1 pb-1.5 transition-opacity duration-[var(--app-duration-fast)] ease-[var(--app-ease)] motion-reduce:transition-none",
        sidebarCollapsed
          ? "pointer-events-auto relative opacity-100 delay-75"
          : "pointer-events-none absolute top-0 left-0 opacity-0",
      )}
    >
      <div
        role="toolbar"
        aria-label={messages.toolbar.quickActions}
        className="flex flex-col items-center gap-2"
      >
        <CompactToolbarGroup>
          <CollapsedLogoToggle
            buttonRef={compactToggleRef}
            label={messages.toolbar.openSidebar}
            title={messages.toolbar.openSidebar}
            onClick={(event) => onToggleCollapsed(false, event.detail === 0)}
          />
        </CompactToolbarGroup>
        <CompactToolbarGroup>
          {toolbarModes.map(({ mode: itemMode, keyHint, icon: Icon }) => (
            <CompactToolbarButton
              key={itemMode}
              label={`${messages.toolbar.modes[itemMode].label} (${keyHint})`}
              title={`${messages.toolbar.modes[itemMode].tooltip} (${keyHint})`}
              active={mode === itemMode}
              onClick={() => onModeChange(itemMode)}
            >
              <Icon className="size-4" />
            </CompactToolbarButton>
          ))}
        </CompactToolbarGroup>
        <CompactToolbarGroup>
          <CompactToolbarButton
            label={`${messages.toolbar.undo.label} (${undoShortcut})`}
            title={`${messages.toolbar.undo.tooltip} (${undoShortcut})`}
            disabled={historyDisabled}
            onClick={onUndo}
          >
            <Undo2 className="size-4" />
          </CompactToolbarButton>
          <CompactToolbarButton
            label={`${messages.toolbar.redo.label} (${redoShortcut})`}
            title={`${messages.toolbar.redo.tooltip} (${redoShortcut})`}
            disabled={futureDisabled}
            onClick={onRedo}
          >
            <Redo2 className="size-4" />
          </CompactToolbarButton>
        </CompactToolbarGroup>
        <CompactToolbarGroup>
          <div className="relative">
            <CompactToolbarButton
              label={
                clearArmed
                  ? messages.toolbar.clear.armedLabel
                  : messages.toolbar.clear.label
              }
              title={
                clearArmed
                  ? messages.toolbar.clear.armedTooltip
                  : messages.toolbar.clear.tooltip
              }
              armed={clearArmed}
              disabled={isGraphEmpty}
              showTooltip={!clearArmed}
              onClick={onClearEditor}
            >
              <Trash2 className="size-4" />
            </CompactToolbarButton>
            {clearArmed ? (
              <span className="pointer-events-none absolute top-1/2 left-[calc(100%+0.5rem)] w-max max-w-[min(18rem,calc(100vw-4rem))] -translate-y-1/2 rounded-[var(--app-radius-pill)] border border-[var(--divider)] bg-[var(--surface)] px-2.5 py-1 text-[length:var(--app-text-xs)] leading-tight font-semibold whitespace-nowrap text-[var(--text)] shadow-[var(--app-shadow-menu)]">
                {messages.toolbar.clear.armedLabel}
              </span>
            ) : null}
          </div>
        </CompactToolbarGroup>
      </div>
    </div>
  );
}

function CompactToolbarGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-center gap-1">{children}</div>;
}

function CompactToolbarButton({
  label,
  title,
  active,
  armed,
  disabled,
  showTooltip = true,
  onClick,
  children,
}: {
  label: string;
  title: string;
  active?: boolean;
  armed?: boolean;
  disabled?: boolean;
  showTooltip?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <span className="group relative block">
      {!disabled && showTooltip ? (
        <span role="tooltip" className="gv-tooltip">
          {title}
        </span>
      ) : null}
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        data-active={active}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "gv-icon-button size-10 rounded-[var(--app-radius-md)]",
          active && "is-active",
          armed &&
            "bg-[var(--err-soft)] text-[var(--err)] ring-2 ring-[var(--err)]/20",
        )}
      >
        {children}
      </button>
    </span>
  );
}

function CollapsedLogoToggle({
  buttonRef,
  label,
  title,
  onClick,
}: {
  buttonRef?: Ref<HTMLButtonElement>;
  label: string;
  title: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <span className="group relative block">
      <span role="tooltip" className="gv-tooltip">
        {title}
      </span>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        onClick={onClick}
        className="gv-icon-button group size-10 rounded-[var(--app-radius-md)]"
      >
        <span className="relative grid size-6 place-items-center">
          <img
            src="/brand/graph-editor-logo.webp"
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
            className="brand-logo-image-light size-6 object-contain transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0"
            draggable={false}
          />
          <img
            src="/brand/graph-editor-logo-dark.webp"
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
            className="brand-logo-image-dark size-6 object-contain transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0"
            draggable={false}
          />
          <PanelLeft
            className="absolute inset-0 m-auto size-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden="true"
          />
        </span>
      </button>
    </span>
  );
}
