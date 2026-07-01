"use client";

import { useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import {
  ChevronDown,
  ChevronUp,
  GitCompareArrows,
  PanelLeft,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";

import type { GraphModel } from "../core/graph/model";
import { manualLayoutDisabledReasonCode, type LayoutKind } from "../layouts";
import { useI18n } from "../i18n/I18nProvider";
import type { EditorMode } from "../shell/state/editor-state";
import { cn } from "@/lib/utils";

import { AppMenu } from "./AppMenu";
import { GraphSettingsControl } from "./GraphSettingsControl";
import { toolbarLayouts, toolbarModes } from "./mode-toolbar-options";

type ExpandedToolbarLayerProps = {
  clearArmed: boolean;
  expandedLayerRef: Ref<HTMLDivElement>;
  expandedToggleRef: Ref<HTMLButtonElement>;
  futureDisabled: boolean;
  graph: GraphModel;
  isGraphEmpty: boolean;
  mode: EditorMode;
  redoShortcut: string;
  showAllLayouts: boolean;
  sidebarCollapsed: boolean;
  undoShortcut: string;
  historyDisabled: boolean;
  onApplyLayout: (kind: LayoutKind) => void;
  onClearEditor: () => void;
  onModeChange: (mode: EditorMode) => void;
  onRedo: () => void;
  onSetShowAllLayouts: (show: boolean) => void;
  onToggleAutoEdgeRouting: () => void;
  onToggleCollapsed: (collapsed: boolean, restoreFocus: boolean) => void;
  onUndo: () => void;
};

const primaryLayouts = toolbarLayouts.filter(
  (layout) => layout.priority === "primary",
);
const advancedLayouts = toolbarLayouts.filter(
  (layout) => layout.priority === "advanced",
);

export function ExpandedToolbarLayer({
  clearArmed,
  expandedLayerRef,
  expandedToggleRef,
  futureDisabled,
  graph,
  historyDisabled,
  isGraphEmpty,
  mode,
  redoShortcut,
  showAllLayouts,
  sidebarCollapsed,
  undoShortcut,
  onApplyLayout,
  onClearEditor,
  onModeChange,
  onRedo,
  onSetShowAllLayouts,
  onToggleAutoEdgeRouting,
  onToggleCollapsed,
  onUndo,
}: ExpandedToolbarLayerProps) {
  const { messages } = useI18n();
  const [contentScrolled, setContentScrolled] = useState(false);
  const layoutDisabledReasons = useMemo(
    () =>
      new Map(
        (showAllLayouts ? toolbarLayouts : primaryLayouts).map(({ kind }) => [
          kind,
          manualLayoutDisabledReasonCode(kind, graph),
        ]),
      ),
    [graph, showAllLayouts],
  );

  return (
    <div className="absolute inset-0 overflow-visible rounded-[inherit]">
      <div
        ref={expandedLayerRef}
        aria-hidden={sidebarCollapsed ? true : undefined}
        inert={sidebarCollapsed ? true : undefined}
        className={cn(
          "absolute top-0 left-0 flex max-h-[calc(100vh-var(--app-space-6))] min-h-0 w-[var(--app-toolbar-width)] flex-col overflow-visible rounded-[inherit] transition-opacity duration-[var(--app-duration-fast)] ease-[var(--app-ease)] motion-reduce:transition-none",
          sidebarCollapsed
            ? "pointer-events-none opacity-0"
            : "pointer-events-auto opacity-100",
        )}
      >
        <div
          className={cn(
            "flex h-[3.25rem] shrink-0 items-center justify-between gap-[var(--app-space-2)] border-b pr-[var(--app-space-2)] pl-[var(--app-space-4)] transition-colors duration-[var(--app-duration-fast)] ease-[var(--app-ease)]",
            contentScrolled ? "border-[var(--divider)]" : "border-transparent",
          )}
        >
          <SidebarTitle />
          <button
            ref={expandedToggleRef}
            type="button"
            aria-label={messages.toolbar.closeSidebar}
            aria-expanded={!sidebarCollapsed}
            onClick={(event) => onToggleCollapsed(true, event.detail === 0)}
            className="gv-icon-button size-10 shrink-0 rounded-[var(--app-radius-md)]"
          >
            <PanelLeft className="size-4" />
          </button>
        </div>

        <div
          className="gv-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-[var(--app-space-4)] overflow-x-hidden overflow-y-auto overscroll-x-none px-[var(--app-space-3)] pt-[var(--app-space-3)] pb-[var(--app-space-3)] [overflow-anchor:none]"
          onScroll={(event) => {
            if (event.currentTarget.scrollLeft !== 0) {
              event.currentTarget.scrollLeft = 0;
            }
            const nextContentScrolled = event.currentTarget.scrollTop > 0;
            setContentScrolled((currentContentScrolled) =>
              currentContentScrolled === nextContentScrolled
                ? currentContentScrolled
                : nextContentScrolled,
            );
          }}
        >
          <ToolbarGroup label={messages.toolbar.groups.actions}>
            {toolbarModes.map(
              ({ mode: itemMode, keyHint, accent, icon: Icon }) => (
                <RailButton
                  key={itemMode}
                  label={messages.toolbar.modes[itemMode].label}
                  tooltip={messages.toolbar.modes[itemMode].tooltip}
                  keyHint={keyHint}
                  accent={accent}
                  active={mode === itemMode}
                  onClick={() => onModeChange(itemMode)}
                >
                  <Icon className="size-4" />
                </RailButton>
              ),
            )}
          </ToolbarGroup>

          <ToolbarGroup label={messages.toolbar.groups.history}>
            <RailButton
              label={messages.toolbar.undo.label}
              tooltip={messages.toolbar.undo.tooltip}
              keyHint={undoShortcut}
              disabled={historyDisabled}
              onClick={onUndo}
            >
              <Undo2 className="size-4" />
            </RailButton>
            <RailButton
              label={messages.toolbar.redo.label}
              tooltip={messages.toolbar.redo.tooltip}
              keyHint={redoShortcut}
              disabled={futureDisabled}
              onClick={onRedo}
            >
              <Redo2 className="size-4" />
            </RailButton>
          </ToolbarGroup>

          <ToolbarGroup label={messages.toolbar.groups.edgeAppearance}>
            <SwitchRailButton
              label={messages.toolbar.autoEdgeRouting.label}
              tooltip={messages.toolbar.autoEdgeRouting.tooltip}
              checked={graph.settings.autoEdgeRouting}
              onClick={onToggleAutoEdgeRouting}
            >
              <GitCompareArrows className="size-4" />
            </SwitchRailButton>
          </ToolbarGroup>

          <ToolbarGroup label={messages.toolbar.groups.layouts}>
            {primaryLayouts.map(({ kind }) => {
              const disabledReason = layoutDisabledReasons.get(kind) ?? null;
              const layout = messages.layouts[kind];

              return (
                <LayoutCard
                  key={kind}
                  label={layout.label}
                  subtitle={layout.subtitle}
                  tooltip={
                    disabledReason
                      ? messages.layouts.disabled[disabledReason]
                      : layout.tooltip
                  }
                  disabled={Boolean(disabledReason)}
                  onClick={() => onApplyLayout(kind)}
                />
              );
            })}
            {!showAllLayouts ? (
              <button
                type="button"
                aria-expanded={false}
                onClick={() => onSetShowAllLayouts(true)}
                className="gv-disclosure-button"
              >
                <span className="min-w-0 flex-1 text-left leading-tight break-words whitespace-normal">
                  {messages.toolbar.moreLayouts}
                </span>
                <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
              </button>
            ) : null}
            {showAllLayouts ? (
              <>
                {advancedLayouts.map(({ kind }) => {
                  const disabledReason =
                    layoutDisabledReasons.get(kind) ?? null;
                  const layout = messages.layouts[kind];

                  return (
                    <LayoutCard
                      key={kind}
                      label={layout.label}
                      subtitle={layout.subtitle}
                      tooltip={
                        disabledReason
                          ? messages.layouts.disabled[disabledReason]
                          : layout.tooltip
                      }
                      disabled={Boolean(disabledReason)}
                      onClick={() => onApplyLayout(kind)}
                    />
                  );
                })}
                <button
                  type="button"
                  aria-expanded={true}
                  onClick={() => onSetShowAllLayouts(false)}
                  className="gv-disclosure-button"
                >
                  <span className="min-w-0 flex-1 text-left leading-tight break-words whitespace-normal">
                    {messages.toolbar.collapseLayouts}
                  </span>
                  <ChevronUp className="size-4 shrink-0" aria-hidden="true" />
                </button>
              </>
            ) : null}
          </ToolbarGroup>

          <ToolbarGroup label={messages.toolbar.groups.settings}>
            <GraphSettingsControl
              onSettingsChange={() => onSetShowAllLayouts(false)}
            />
          </ToolbarGroup>

          <div className="flex min-w-0 flex-col">
            <RailButton
              label={
                clearArmed
                  ? messages.toolbar.clear.armedLabel
                  : messages.toolbar.clear.label
              }
              tooltip={
                clearArmed
                  ? messages.toolbar.clear.armedTooltip
                  : messages.toolbar.clear.tooltip
              }
              disabled={isGraphEmpty}
              onClick={onClearEditor}
            >
              <Trash2 className="size-4" />
            </RailButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarTitle() {
  const { messages } = useI18n();
  const appMenuBoundaryRef = useRef<HTMLDivElement | null>(null);
  const [appMenuOpen, setAppMenuOpen] = useState(false);

  return (
    <div ref={appMenuBoundaryRef} className="relative min-w-0">
      <button
        type="button"
        aria-label={messages.appMenu.open}
        aria-expanded={appMenuOpen}
        aria-haspopup="menu"
        onClick={() => setAppMenuOpen((open) => !open)}
        className="flex max-w-full min-w-0 items-center gap-[var(--app-space-2)] rounded-[var(--app-radius-md)] py-1 pr-2 pl-1 text-left transition-colors hover:bg-[var(--state-hover-bg)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none"
      >
        <span className="relative grid size-6 shrink-0 place-items-center">
          <img
            src="/brand/graph-editor-logo.webp"
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
            className="brand-logo-image-light size-6 object-contain select-none"
            draggable={false}
          />
          <img
            src="/brand/graph-editor-logo-dark.webp"
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
            className="brand-logo-image-dark size-6 object-contain select-none"
            draggable={false}
          />
        </span>
        <span className="flex min-w-0 flex-col justify-center">
          <span
            translate="no"
            className="truncate [font-family:var(--app-font-display)] text-[0.9375rem] leading-5 font-bold text-[var(--text)]"
          >
            {messages.app.title}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-[var(--text-mute)] transition-transform duration-[var(--app-duration-fast)] ease-[var(--app-ease)]",
            appMenuOpen && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      <AppMenu
        boundaryRef={appMenuBoundaryRef}
        open={appMenuOpen}
        onClose={() => setAppMenuOpen(false)}
      />
    </div>
  );
}

function ToolbarGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-[var(--app-space-2)]">
      <div className="flex items-baseline px-[var(--app-space-1)]">
        <div className="gv-section-label">{label}</div>
      </div>
      <div className="flex min-w-0 flex-col gap-[var(--app-space-1)]">
        {children}
      </div>
    </section>
  );
}

function LayoutCard({
  label,
  subtitle,
  tooltip,
  disabled,
  onClick,
}: {
  label: string;
  subtitle: string;
  tooltip: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${label}: ${subtitle}`}
      disabled={disabled}
      title={tooltip}
      onClick={onClick}
      className="gv-rail-button"
    >
      <span className="min-w-0 flex-1 text-[length:var(--app-text-sm)] leading-tight font-semibold break-words whitespace-normal">
        {label}
      </span>
    </button>
  );
}

function RailButton({
  label,
  tooltip,
  keyHint,
  active,
  accent,
  disabled,
  onClick,
  compact,
  children,
}: {
  label: string;
  tooltip: string;
  keyHint?: string;
  active?: boolean;
  accent?: "create" | "connect";
  disabled?: boolean;
  onClick: () => void;
  compact?: boolean;
  children?: ReactNode;
}) {
  const tooltipText = keyHint ? `${tooltip} (${keyHint})` : tooltip;

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        data-active={active}
        data-accent={accent}
        data-graph-shortcut-target="true"
        disabled={disabled}
        onClick={onClick}
        title={tooltipText}
        className={cn(
          "gv-rail-button",
          active && "is-active",
          compact &&
            "min-h-8 py-[var(--app-space-1)] text-[length:var(--app-text-sm)]",
        )}
      >
        {children ? (
          <span className="grid size-5 shrink-0 place-items-center">
            {children}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 text-[length:var(--app-text-sm)] leading-tight font-semibold break-words whitespace-normal">
          {label}
        </span>
        {keyHint ? <ShortcutHint value={keyHint} active={active} /> : null}
      </button>
    </div>
  );
}

function SwitchRailButton({
  label,
  tooltip,
  checked,
  disabled,
  onClick,
  children,
}: {
  label: string;
  tooltip: string;
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        role="switch"
        aria-label={label}
        aria-checked={checked}
        data-graph-shortcut-target="true"
        disabled={disabled}
        onClick={onClick}
        title={tooltip}
        className="gv-rail-button"
      >
        {children ? (
          <span className="grid size-5 shrink-0 place-items-center">
            {children}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 text-[length:var(--app-text-sm)] leading-tight font-semibold break-words whitespace-normal">
          {label}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
            checked ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]",
          )}
        >
          <span
            className={cn(
              "absolute top-1/2 size-4 -translate-y-1/2 rounded-full transition-[background-color,left] duration-[var(--app-duration-base)] ease-[var(--app-ease)]",
              checked
                ? "left-[1.125rem] bg-[var(--accent-contrast)]"
                : "left-0.5 bg-[var(--text-mute)]",
            )}
          />
        </span>
      </button>
    </div>
  );
}

function ShortcutHint({ value, active }: { value: string; active?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ml-auto shrink-0 [font-family:var(--app-font-ui)] text-[13px] leading-none font-semibold tracking-normal whitespace-nowrap",
        active
          ? "text-[var(--state-selected-text)]"
          : "text-[var(--text-dim)] opacity-90",
      )}
    >
      {formatShortcutHint(value)}
    </span>
  );
}

function formatShortcutHint(value: string) {
  if (!value.includes("+")) {
    return value;
  }

  const keys = value.split("+").filter(Boolean);
  const canJoin = keys.every((key) => /^[⇧⌘⌥⌃]$|^[A-Za-z0-9]$/.test(key));
  return canJoin ? keys.join("") : value;
}
