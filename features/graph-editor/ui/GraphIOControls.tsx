"use client";

import {
  Camera,
  Check,
  Download,
  type LucideIcon,
  Moon,
  Sun,
} from "lucide-react";

import { DropdownShell, ExportPanel } from "./GraphIOPanels";
import { hasLossyAdjacencyExport } from "../io/export-graph";
import {
  ScreenshotFooter,
  ScreenshotPanel,
  ScreenshotTitle,
} from "./GraphScreenshotPanel";
import { useGraphIOController } from "./graph-io-controller";
import type { ScreenshotCopyState } from "./graph-io-types";
import { useI18n } from "../i18n/I18nProvider";

export function GraphIOControls() {
  const { messages } = useI18n();
  const controller = useGraphIOController();
  const screenshotRail = getScreenshotRailState({
    copyMessage: controller.screenshot.copyMessage,
    copyState: controller.screenshot.copyState,
    messages,
    screenshotOpen: controller.screenshotOpen,
  });

  return (
    <>
      <div
        ref={controller.railRef}
        className="gv-right-rail fixed top-[var(--app-space-3)] right-[var(--app-space-3)] z-[90] flex flex-col items-center gap-1 rounded-[calc(var(--app-radius-md)+2px)] border border-[var(--divider)] p-1 shadow-[var(--app-shadow-card)] backdrop-blur-xl"
      >
        <RailActionButton
          label={
            controller.theme === "dark"
              ? messages.common.lightMode
              : messages.common.darkMode
          }
          ariaLabel={
            controller.theme === "dark"
              ? messages.common.switchLightMode
              : messages.common.switchDarkMode
          }
          title={
            controller.theme === "dark"
              ? messages.common.switchLightMode
              : messages.common.switchDarkMode
          }
          icon={controller.theme === "dark" ? Sun : Moon}
          onClick={() => controller.setTheme(controller.nextTheme)}
        />
        <RailActionButton
          label={messages.exportPanel.title}
          ariaLabel={messages.exportPanel.title}
          icon={Download}
          active={controller.exportOpen}
          expanded={controller.exportOpen}
          onClick={controller.actions.openExportPanel}
        />
        <RailActionButton
          label={screenshotRail.label}
          ariaLabel={screenshotRail.ariaLabel}
          title={screenshotRail.title}
          icon={screenshotRail.icon === "check" ? Check : Camera}
          active={screenshotRail.active}
          expanded={controller.screenshotOpen}
          disabled={screenshotRail.disabled}
          onClick={controller.actions.openScreenshotPanel}
        />
      </div>

      {controller.panelPresence.value === "export" ? (
        <DropdownShell
          panelRef={controller.panelRef}
          panelState={controller.panelPresence.state}
          right={controller.panelRight}
          title={messages.exportPanel.title}
          onClose={() => controller.setOpenPanel(null)}
        >
          <ExportPanel
            copyState={controller.copyState}
            edgeCount={controller.graph.edges.length}
            exportFormat={controller.exportFormat}
            exportText={controller.exportText}
            exportWarning={
              hasLossyAdjacencyExport(controller.graph, controller.exportFormat)
                ? messages.exportPanel.adjacencyLossWarning
                : undefined
            }
            nodeCount={controller.graph.nodes.length}
            onCopyExport={() => void controller.actions.copyExport()}
            onExportFormatChange={controller.setExportFormat}
          />
        </DropdownShell>
      ) : null}

      {controller.panelPresence.value === "screenshot" ? (
        <DropdownShell
          panelRef={controller.panelRef}
          panelState={controller.panelPresence.state}
          right={controller.panelRight}
          title={<ScreenshotTitle />}
          footer={
            <ScreenshotFooter
              isGraphEmpty={controller.isGraphEmpty}
              screenshotCopyState={controller.screenshot.copyState}
              screenshotDownloadState={controller.screenshot.downloadState}
              onCopyScreenshot={controller.screenshot.copy}
              onDownloadScreenshot={controller.screenshot.download}
            />
          }
          onClose={() => controller.setOpenPanel(null)}
        >
          <ScreenshotPanel
            effectiveBackground={controller.screenshot.effectiveBackground}
            screenshotCustomLongEdgePx={controller.screenshot.customLongEdgePx}
            screenshotCustomPaddingPx={controller.screenshot.customPaddingPx}
            screenshotCopyMessage={controller.screenshot.copyMessage}
            screenshotDownloadMessage={controller.screenshot.downloadMessage}
            screenshotLongEdgePreset={controller.screenshot.longEdgePreset}
            screenshotPaddingPreset={controller.screenshot.paddingPreset}
            screenshotPreview={controller.screenshot.preview}
            solidBackground={controller.screenshot.solidBackground}
            theme={controller.theme}
            onScreenshotCustomLongEdgeChange={
              controller.screenshot.setCustomLongEdgePx
            }
            onScreenshotCustomPaddingChange={
              controller.screenshot.setCustomPaddingPx
            }
            onScreenshotBackgroundChange={controller.screenshot.setBackground}
          />
        </DropdownShell>
      ) : null}
    </>
  );
}

function getScreenshotRailState({
  copyMessage,
  copyState,
  messages,
  screenshotOpen,
}: {
  copyMessage: string;
  copyState: ScreenshotCopyState;
  messages: ReturnType<typeof useI18n>["messages"];
  screenshotOpen: boolean;
}) {
  const settled =
    copyState === "copied" || copyState === "saved" || copyState === "blocked";

  return {
    active: screenshotOpen || settled,
    ariaLabel:
      copyState === "copied"
        ? messages.screenshot.copiedAria
        : copyState === "saved"
          ? messages.screenshot.savedAria
          : copyState === "blocked"
            ? messages.screenshot.blockedAria
            : messages.screenshot.openAria,
    disabled: copyState === "copying",
    icon: copyState === "copied" || copyState === "saved" ? "check" : "camera",
    label: screenshotOpen ? "PNG" : screenshotRailLabel(copyState, messages),
    title:
      copyState === "saved" || copyState === "blocked"
        ? copyMessage
        : messages.screenshot.titleIdle,
  } as const;
}

function screenshotRailLabel(
  copyState: ScreenshotCopyState,
  messages: ReturnType<typeof useI18n>["messages"],
) {
  switch (copyState) {
    case "copying":
      return messages.common.copying;
    case "copied":
      return messages.common.copied;
    case "saved":
      return messages.common.saved;
    case "blocked":
      return messages.common.failed;
    case "idle":
      return "PNG";
  }
}

function RailActionButton({
  label,
  ariaLabel,
  title,
  icon: Icon,
  active,
  expanded,
  disabled,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  title?: string;
  icon: LucideIcon;
  active?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="group relative">
      {!disabled && !expanded ? (
        <span role="tooltip" data-side="left" className="gv-tooltip">
          {label}
        </span>
      ) : null}
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={expanded}
        title={title ?? label}
        disabled={disabled}
        data-active={active || expanded}
        onClick={onClick}
        className="gv-icon-button size-10 rounded-[var(--app-radius-md)] bg-transparent"
      >
        <Icon className="size-4" />
      </button>
    </div>
  );
}
