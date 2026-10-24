"use client";

import { IMAGE_EXPORT_ERROR } from "../../adapters/cytoscape/graph-canvas-viewport";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  useGraphCanvasApi,
  useGraphCanvasExportScaleSignature,
  useGraphCanvasViewportSignature,
} from "../../canvas/GraphCanvasProvider";
import { EXPORT_BACKGROUND_COLORS } from "../../adapters/cytoscape/graph-canvas-viewport";
import {
  downloadBlob,
  ensurePngBlob,
  formatTimestamp,
} from "../../adapters/browser/file-actions";
import { useI18n } from "../../i18n/I18nProvider";
import type {
  PngExportBackground,
  PngExportLongEdgePreset,
  PngExportPaddingPreset,
  PngExportScope,
  ScreenshotCopyState,
  ScreenshotDownloadState,
  ScreenshotPreview,
} from "./graph-io-types";
import { DEFAULT_PADDING_PX, DEFAULT_LONG_EDGE_PX } from "./graph-io-types";
import {
  clampLongEdgePx,
  clampPaddingPx,
  clampPaddingPxForLongEdge,
  createEmptyScreenshotPreview,
  isScreenshotPreviewStale,
  makeScreenshotInputKey,
  resolveLongEdgePx,
  resolvePaddingPx,
  resolvePngCanvasLayout,
  shouldAcceptScreenshotPreviewRequest,
} from "./graph-io-screenshot-state";
import type { ThemeMode } from "../theme/theme";
import { useDebouncedValue } from "../hooks/use-debounced-value";
import { useScreenshotAction } from "./graph-io-screenshot-action";

type GraphIOScreenshotOptions = {
  graphRevision: number;
  isGraphEmpty: boolean;
  previewEnabled: boolean;
  theme: ThemeMode;
};

export function useGraphIOScreenshot({
  graphRevision,
  isGraphEmpty,
  previewEnabled,
  theme,
}: GraphIOScreenshotOptions) {
  const { messages } = useI18n();
  const [previewMessage, setPreviewMessage] = useState({
    inputKey: "",
    message: "",
  });
  const [background, setBackgroundState] =
    useState<PngExportBackground>("white");
  const [longEdgePreset, setLongEdgePresetState] =
    useState<PngExportLongEdgePreset>(DEFAULT_LONG_EDGE_PX);
  const [customLongEdgePx, setCustomLongEdgePxState] =
    useState(DEFAULT_LONG_EDGE_PX);
  const [canvasWidthPx, setCanvasWidthPx] = useState(1920);
  const [canvasHeightPx, setCanvasHeightPx] = useState(1080);
  const [paddingPreset, setPaddingPresetState] =
    useState<PngExportPaddingPreset>(DEFAULT_PADDING_PX);
  const [customPaddingPx, setCustomPaddingPxState] =
    useState(DEFAULT_PADDING_PX);
  const [scope, setScopeState] = useState<PngExportScope>("full");
  const [preview, setPreview] = useState<ScreenshotPreview>(
    createEmptyScreenshotPreview,
  );
  const previewUrlRef = useRef("");
  const previewRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const { exportPng } = useGraphCanvasApi();
  const exportScaleSignature = useGraphCanvasExportScaleSignature(
    previewEnabled && (scope === "natural" || scope === "natural-fixed"),
  );
  const viewportSignature = useGraphCanvasViewportSignature(
    previewEnabled && scope === "viewport",
  );
  const solidBackground: "white" | "black" =
    theme === "dark" ? "black" : "white";
  const effectiveBackground: PngExportBackground =
    background === "transparent" ? background : solidBackground;
  const currentPreviewInput = useMemo(
    () => ({
      background: effectiveBackground,
      canvasHeightPx,
      canvasWidthPx,
      graphRevision,
      longEdgePx: resolveLongEdgePx(longEdgePreset, customLongEdgePx),
      paddingPx: resolvePaddingPx(paddingPreset, customPaddingPx),
      scope,
      theme,
      exportScaleSignature,
      viewportSignature,
    }),
    [
      customLongEdgePx,
      canvasHeightPx,
      canvasWidthPx,
      customPaddingPx,
      effectiveBackground,
      graphRevision,
      longEdgePreset,
      paddingPreset,
      scope,
      theme,
      exportScaleSignature,
      viewportSignature,
    ],
  );
  const debouncedPreviewInput = useDebouncedValue(currentPreviewInput, 150);
  const currentPreviewInputKey = useMemo(
    () => makeScreenshotInputKey(currentPreviewInput),
    [currentPreviewInput],
  );
  const debouncedPreviewInputKey = useMemo(
    () => makeScreenshotInputKey(debouncedPreviewInput),
    [debouncedPreviewInput],
  );
  const copyAction = useScreenshotAction<
    Exclude<ScreenshotCopyState, "copying">
  >(currentPreviewInputKey, mountedRef);
  const downloadAction = useScreenshotAction<
    Exclude<ScreenshotDownloadState, "saving">
  >(currentPreviewInputKey, mountedRef);
  const copyState: ScreenshotCopyState = copyAction.pending
    ? "copying"
    : copyAction.state;
  const downloadState: ScreenshotDownloadState = downloadAction.pending
    ? "saving"
    : downloadAction.state;
  const copyMessage = copyAction.message;
  const downloadMessage =
    downloadAction.message ||
    (previewMessage.inputKey === currentPreviewInputKey
      ? previewMessage.message
      : "");
  const visiblePreview = isGraphEmpty
    ? createEmptyScreenshotPreview()
    : preview;
  const previewStale = isScreenshotPreviewStale(
    visiblePreview,
    currentPreviewInputKey,
  );

  const previewReadyToRefresh =
    currentPreviewInputKey === debouncedPreviewInputKey &&
    (previewStale || visiblePreview.state !== "ready");

  const resetFeedback = () => {
    copyAction.resetFeedback();
    downloadAction.resetFeedback();
    setPreviewMessage({ inputKey: "", message: "" });
  };

  const createBlob = async (
    {
      background: exportBackground,
      canvasHeightPx: exportCanvasHeightPx,
      canvasWidthPx: exportCanvasWidthPx,
      longEdgePx,
      paddingPx,
      scope: exportScope,
    }: {
      background: PngExportBackground;
      canvasHeightPx: number;
      canvasWidthPx: number;
      longEdgePx: number;
      paddingPx: number;
      scope: PngExportScope;
    },
    signal?: AbortSignal,
  ) => {
    signal?.throwIfAborted();
    if (isGraphEmpty) {
      throw new Error(IMAGE_EXPORT_ERROR.emptyGraph);
    }

    const safePaddingPx =
      exportScope === "full"
        ? clampPaddingPxForLongEdge(paddingPx, longEdgePx)
        : clampPaddingPx(paddingPx);
    const contentLongEdgePx = Math.max(1, longEdgePx - safePaddingPx * 2);
    const sizeOptions =
      exportScope === "full"
        ? { maxHeight: contentLongEdgePx, maxWidth: contentLongEdgePx }
        : {};

    const blob = await exportPng({
      scope: exportScope,
      background: exportBackground,
      ...sizeOptions,
      includeSelection: false,
      signal,
    });
    signal?.throwIfAborted();
    return addPngPadding(
      ensurePngBlob(blob),
      {
        background: exportBackground,
        paddingPx: safePaddingPx,
        targetWidthPx:
          exportScope === "natural-fixed" ? exportCanvasWidthPx : undefined,
        targetHeightPx:
          exportScope === "natural-fixed" ? exportCanvasHeightPx : undefined,
      },
      signal,
    );
  };

  function clearPreview() {
    previewRequestRef.current += 1;
    revokePreviewUrl();
    setPreview(createEmptyScreenshotPreview());
  }

  function revokePreviewUrl() {
    if (!previewUrlRef.current) {
      return;
    }

    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
  }

  async function refreshPreview(signal: AbortSignal) {
    const inputKey = debouncedPreviewInputKey;
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;

    if (isGraphEmpty) {
      clearPreview();
      return;
    }

    setPreview((currentPreview) =>
      currentPreview.state === "ready" && currentPreview.url
        ? currentPreview
        : {
            height: null,
            inputKey,
            state: "loading",
            url: "",
            width: null,
          },
    );

    let objectUrl = "";
    try {
      const blob = await createBlob(debouncedPreviewInput, signal);
      signal.throwIfAborted();
      objectUrl = URL.createObjectURL(blob);
      const { height, width } = await readImageDimensions(objectUrl, signal);

      if (
        signal.aborted ||
        !mountedRef.current ||
        !shouldAcceptScreenshotPreviewRequest(
          previewRequestRef.current,
          requestId,
        )
      ) {
        return;
      }

      revokePreviewUrl();
      previewUrlRef.current = objectUrl;
      setPreviewMessage({ inputKey: "", message: "" });
      setPreview({
        height,
        inputKey,
        state: "ready",
        url: objectUrl,
        width,
      });

      objectUrl = "";
    } catch (error) {
      if (signal.aborted || !mountedRef.current) return;
      console.warn("Screenshot preview failed", error);
      if (
        shouldAcceptScreenshotPreviewRequest(
          previewRequestRef.current,
          requestId,
        )
      ) {
        if (
          error instanceof Error &&
          error.message === "image-export:canvas-too-small"
        ) {
          setPreviewMessage({
            inputKey,
            message: messages.screenshot.canvasTooSmall,
          });
        }
        revokePreviewUrl();
        setPreview({
          height: null,
          inputKey,
          state: "failed",
          url: "",
          width: null,
        });
      }
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  const createBlobForAction = () =>
    createBlob({
      background: effectiveBackground,
      canvasHeightPx,
      canvasWidthPx,
      longEdgePx: resolveLongEdgePx(longEdgePreset, customLongEdgePx),
      paddingPx: resolvePaddingPx(paddingPreset, customPaddingPx),
      scope,
    });

  const copy = () => {
    if (isGraphEmpty) return;
    const ticket = copyAction.begin();
    if (!ticket) return;
    const pngBlobPromise = createBlobForAction();

    const markFailed = (message: string) => {
      if (mountedRef.current) console.warn("Screenshot copy failed", message);
      copyAction.finish(ticket, "blocked", message);
    };

    const copyBlob = async () => {
      try {
        if (
          !navigator.clipboard?.write ||
          typeof ClipboardItem === "undefined"
        ) {
          throw new DOMException(
            "Clipboard image write is unavailable",
            "NotAllowedError",
          );
        }

        await writePngBlobToClipboard(pngBlobPromise);
        copyAction.finish(ticket, "copied");
      } catch (error) {
        console.warn("Clipboard image write failed", error);
        try {
          const pngBlob = await pngBlobPromise;
          downloadBlob(
            pngBlob,
            `graph-editor-${formatTimestamp(new Date())}.png`,
          );
          copyAction.finish(
            ticket,
            "saved",
            messages.screenshot.copyFallbackSaved,
          );
        } catch (downloadError) {
          console.warn("Fallback screenshot download failed", downloadError);
          markFailed(
            downloadError instanceof Error &&
              downloadError.message === "image-export:canvas-too-small"
              ? messages.screenshot.canvasTooSmall
              : messages.screenshot.copyFailed,
          );
        }
      }
    };

    void copyBlob();
  };

  const download = () => {
    if (isGraphEmpty) return;
    const ticket = downloadAction.begin();
    if (!ticket) return;
    setPreviewMessage({ inputKey: "", message: "" });

    const markFailed = (message: string) => {
      if (mountedRef.current)
        console.warn("Screenshot download failed", message);
      downloadAction.finish(ticket, "failed", message);
    };

    const saveBlob = (pngBlob: Blob) => {
      try {
        downloadBlob(
          pngBlob,
          `graph-editor-${formatTimestamp(new Date())}.png`,
        );
        downloadAction.finish(ticket, "saved");
      } catch (error) {
        console.warn("PNG download failed", error);
        markFailed(messages.screenshot.downloadFailed);
      }
    };

    void createBlobForAction()
      .then(saveBlob)
      .catch((error) =>
        markFailed(
          error instanceof Error &&
            error.message === IMAGE_EXPORT_ERROR.emptyGraph
            ? messages.screenshot.emptyGraph
            : error instanceof Error &&
                error.message === "image-export:canvas-too-small"
              ? messages.screenshot.canvasTooSmall
              : messages.screenshot.downloadFailed,
        ),
      );
  };

  const setBackground = (nextBackground: PngExportBackground) => {
    setBackgroundState(nextBackground);
    resetFeedback();
  };

  const setPaddingPreset = (nextPreset: PngExportPaddingPreset) => {
    setPaddingPresetState(nextPreset);
    resetFeedback();
  };

  const setCustomPaddingPx = (nextPaddingPx: number) => {
    const paddingPx = clampPaddingPx(nextPaddingPx);
    setPaddingPresetState("custom");
    setCustomPaddingPxState(paddingPx);
    resetFeedback();
  };

  const setLongEdgePreset = (nextPreset: PngExportLongEdgePreset) => {
    setLongEdgePresetState(nextPreset);
    resetFeedback();
  };

  const setCustomLongEdgePx = (nextLongEdgePx: number) => {
    const longEdgePx = clampLongEdgePx(nextLongEdgePx);
    setLongEdgePresetState("custom");
    setCustomLongEdgePxState(longEdgePx);
    resetFeedback();
  };

  const setCanvasWidth = (value: number) => {
    setCanvasWidthPx(value);
    resetFeedback();
  };

  const setCanvasHeight = (value: number) => {
    setCanvasHeightPx(value);
    resetFeedback();
  };

  const setScope = (nextScope: PngExportScope) => {
    setScopeState(nextScope);
    resetFeedback();
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      previewRequestRef.current += 1;
      revokePreviewUrl();
    };
  }, []);

  useEffect(() => {
    if (isGraphEmpty) {
      clearPreview();
      return;
    }
    if (!previewEnabled || !previewReadyToRefresh) {
      return;
    }

    const controller = new AbortController();
    void refreshPreview(controller.signal);
    return () => controller.abort();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPreviewInputKey,
    debouncedPreviewInputKey,
    isGraphEmpty,
    previewEnabled,
  ]);

  return {
    background,
    canvasHeightPx,
    canvasWidthPx,
    copy,
    copyMessage,
    copyState,
    download,
    downloadMessage,
    downloadState,
    effectiveBackground,
    customPaddingPx,
    customLongEdgePx,
    longEdgePreset,
    paddingPreset,
    preview: visiblePreview,
    previewStale,
    scope,
    setBackground,
    setCanvasHeightPx: setCanvasHeight,
    setCanvasWidthPx: setCanvasWidth,
    setCustomLongEdgePx,
    setCustomPaddingPx,
    setScope,
    setLongEdgePreset,
    setPaddingPreset,
    solidBackground,
  };
}

function readImageDimensions(url: string, signal?: AbortSignal) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const image = new Image();
    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
      image.onload = null;
      image.onerror = null;
    };
    const onAbort = () => {
      cleanup();
      image.src = "";
      reject(signal?.reason);
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    image.onload = () => {
      cleanup();
      resolve({
        height: image.naturalHeight,
        width: image.naturalWidth,
      });
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("Could not read PNG dimensions"));
    };
    image.src = url;
  });
}

async function addPngPadding(
  blob: Blob,
  {
    background,
    paddingPx,
    targetHeightPx,
    targetWidthPx,
  }: {
    background: PngExportBackground;
    paddingPx: number;
    targetHeightPx?: number;
    targetWidthPx?: number;
  },
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  if (paddingPx === 0 && !targetWidthPx && !targetHeightPx) {
    return blob;
  }

  const image = await createImageBitmap(blob);
  let canvas: HTMLCanvasElement;
  try {
    signal?.throwIfAborted();
    const layout = resolvePngCanvasLayout(
      image.width,
      image.height,
      paddingPx,
      targetWidthPx,
      targetHeightPx,
    );
    canvas = document.createElement("canvas");
    canvas.width = layout.width;
    canvas.height = layout.height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare padded PNG");

    if (background !== "transparent") {
      context.fillStyle = readPaddedPngBackground(background);
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(image, layout.x, layout.y);
  } finally {
    image.close();
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((paddedBlob) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      if (paddedBlob) {
        resolve(paddedBlob);
        return;
      }

      reject(new Error("Could not create padded PNG"));
    }, "image/png");
  });
}

async function writePngBlobToClipboard(pngBlobPromise: Promise<Blob>) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new DOMException(
      "Clipboard image write is unavailable",
      "NotAllowedError",
    );
  }

  const itemData: Record<string, Blob | Promise<Blob | string> | string> = {
    "image/png": pngBlobPromise,
  };
  const ClipboardItemClass = ClipboardItem as typeof ClipboardItem & {
    supports?: (type: string) => boolean;
  };

  if (ClipboardItemClass.supports?.("text/html")) {
    itemData["text/html"] = pngBlobPromise.then(createClipboardImageHtml);
  }

  await navigator.clipboard.write([
    new ClipboardItemClass(itemData, { presentationStyle: "inline" }),
  ]);
}

async function createClipboardImageHtml(blob: Blob) {
  const [dataUrl, dimensions] = await Promise.all([
    readBlobAsDataUrl(blob),
    readBlobDimensions(blob),
  ]);

  return [
    `<img src="${escapeHtmlAttribute(dataUrl)}"`,
    `width="${dimensions.width}"`,
    `height="${dimensions.height}"`,
    `style="width:${dimensions.width}px;height:${dimensions.height}px"`,
    `alt="">`,
  ].join(" ");
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Could not prepare clipboard image HTML"));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read PNG for clipboard"));
    reader.readAsDataURL(blob);
  });
}

async function readBlobDimensions(blob: Blob) {
  const image = await createImageBitmap(blob);
  const dimensions = {
    height: image.height,
    width: image.width,
  };
  image.close();

  return dimensions;
}

function escapeHtmlAttribute(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function readPaddedPngBackground(
  background: Exclude<PngExportBackground, "transparent">,
) {
  return EXPORT_BACKGROUND_COLORS[background];
}
