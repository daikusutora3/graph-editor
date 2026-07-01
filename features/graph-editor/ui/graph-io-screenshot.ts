"use client";

import type { MutableRefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useGraphCanvasApi } from "../canvas/GraphCanvasProvider";
import type { GraphModel } from "../core/graph/model";
import {
  downloadBlob,
  ensurePngBlob,
  formatTimestamp,
} from "../adapters/browser/file-actions";
import { useI18n } from "../i18n/I18nProvider";
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
  shouldAcceptScreenshotPreviewRequest,
} from "./graph-io-screenshot-state";
import type { ThemeMode } from "./theme";

type GraphIOScreenshotOptions = {
  graph: GraphModel;
  isGraphEmpty: boolean;
  previewEnabled: boolean;
  theme: ThemeMode;
};

export function useGraphIOScreenshot({
  graph,
  isGraphEmpty,
  previewEnabled,
  theme,
}: GraphIOScreenshotOptions) {
  const { messages } = useI18n();
  const [copyState, setCopyState] = useState<ScreenshotCopyState>("idle");
  const [copyMessage, setCopyMessage] = useState("");
  const [downloadState, setDownloadState] =
    useState<ScreenshotDownloadState>("idle");
  const [downloadMessage, setDownloadMessage] = useState("");
  const [background, setBackgroundState] =
    useState<PngExportBackground>("white");
  const [longEdgePreset, setLongEdgePresetState] =
    useState<PngExportLongEdgePreset>(DEFAULT_LONG_EDGE_PX);
  const [customLongEdgePx, setCustomLongEdgePxState] =
    useState(DEFAULT_LONG_EDGE_PX);
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
  const copyResetTimeoutRef = useRef<number | null>(null);
  const downloadResetTimeoutRef = useRef<number | null>(null);
  const { exportPng } = useGraphCanvasApi();
  const solidBackground: "white" | "black" =
    theme === "dark" ? "black" : "white";
  const effectiveBackground: PngExportBackground =
    background === "transparent" ? background : solidBackground;
  const currentPreviewInput = useMemo(
    () => ({
      background: effectiveBackground,
      graph,
      longEdgePx: resolveLongEdgePx(longEdgePreset, customLongEdgePx),
      paddingPx: resolvePaddingPx(paddingPreset, customPaddingPx),
      scope,
      theme,
    }),
    [
      customLongEdgePx,
      customPaddingPx,
      effectiveBackground,
      graph,
      longEdgePreset,
      paddingPreset,
      scope,
      theme,
    ],
  );
  const currentPreviewInputKey = useMemo(
    () => makeScreenshotInputKey(currentPreviewInput),
    [currentPreviewInput],
  );
  const visiblePreview = isGraphEmpty
    ? createEmptyScreenshotPreview()
    : preview;
  const previewStale = isScreenshotPreviewStale(
    visiblePreview,
    currentPreviewInputKey,
  );

  const resetFeedback = () => {
    clearTimeoutRef(copyResetTimeoutRef);
    clearTimeoutRef(downloadResetTimeoutRef);
    setCopyState("idle");
    setCopyMessage("");
    setDownloadState("idle");
    setDownloadMessage("");
  };

  const scheduleCopyReset = () => {
    clearTimeoutRef(copyResetTimeoutRef);
    copyResetTimeoutRef.current = window.setTimeout(
      () => setCopyState("idle"),
      2400,
    );
  };

  const scheduleDownloadReset = () => {
    clearTimeoutRef(downloadResetTimeoutRef);
    downloadResetTimeoutRef.current = window.setTimeout(
      () => setDownloadState("idle"),
      2400,
    );
  };

  const createBlob = ({
    background,
    longEdgePx,
    paddingPx,
    scope,
  }: {
    background: PngExportBackground;
    longEdgePx: number;
    paddingPx: number;
    scope: PngExportScope;
  }) => {
    if (isGraphEmpty) {
      return Promise.reject(new Error("グラフが空です"));
    }

    const safePaddingPx =
      scope === "full"
        ? clampPaddingPxForLongEdge(paddingPx, longEdgePx)
        : clampPaddingPx(paddingPx);
    const contentLongEdgePx = Math.max(1, longEdgePx - safePaddingPx * 2);
    const sizeOptions =
      scope === "full"
        ? { maxHeight: contentLongEdgePx, maxWidth: contentLongEdgePx }
        : {};

    return exportPng({
      scope,
      background,
      ...sizeOptions,
      includeSelection: false,
    })
      .then(ensurePngBlob)
      .then((blob) =>
        addPngPadding(blob, { background, paddingPx: safePaddingPx }),
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

  async function refreshPreview(
    input: {
      background?: PngExportBackground;
      longEdgePx?: number;
      paddingPx?: number;
      scope?: PngExportScope;
    } = {},
  ) {
    const nextInput = {
      background: input.background ?? effectiveBackground,
      graph,
      longEdgePx:
        input.longEdgePx ?? resolveLongEdgePx(longEdgePreset, customLongEdgePx),
      paddingPx:
        input.paddingPx ?? resolvePaddingPx(paddingPreset, customPaddingPx),
      scope: input.scope ?? scope,
      theme,
    };
    const inputKey = makeScreenshotInputKey(nextInput);
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

    try {
      const blob = await createBlob(nextInput);
      const objectUrl = URL.createObjectURL(blob);
      const { height, width } = await readImageDimensions(objectUrl);

      if (
        !shouldAcceptScreenshotPreviewRequest(
          previewRequestRef.current,
          requestId,
        )
      ) {
        URL.revokeObjectURL(objectUrl);
        return;
      }

      revokePreviewUrl();
      previewUrlRef.current = objectUrl;
      setPreview({
        height,
        inputKey,
        state: "ready",
        url: objectUrl,
        width,
      });
    } catch (error) {
      console.warn("Screenshot preview failed", error);
      if (
        shouldAcceptScreenshotPreviewRequest(
          previewRequestRef.current,
          requestId,
        )
      ) {
        setPreview({
          height: null,
          inputKey,
          state: "failed",
          url: "",
          width: null,
        });
      }
    }
  }

  const createBlobForAction = () =>
    createBlob({
      background: effectiveBackground,
      longEdgePx: resolveLongEdgePx(longEdgePreset, customLongEdgePx),
      paddingPx: resolvePaddingPx(paddingPreset, customPaddingPx),
      scope,
    });

  const copy = () => {
    if (isGraphEmpty || copyState === "copying") {
      return;
    }

    setCopyState("copying");
    setCopyMessage("");
    const pngBlobPromise = createBlobForAction();

    const markFailed = (message: string) => {
      console.warn("Screenshot copy failed", message);
      setCopyMessage(message);
      setCopyState("blocked");
      scheduleCopyReset();
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
        setCopyState("copied");
        scheduleCopyReset();
      } catch (error) {
        console.warn("Clipboard image write failed", error);
        try {
          const pngBlob = await pngBlobPromise;
          downloadBlob(
            pngBlob,
            `graph-editor-${formatTimestamp(new Date())}.png`,
          );
          setCopyMessage(messages.screenshot.copyFallbackSaved);
          setCopyState("saved");
          scheduleCopyReset();
        } catch (downloadError) {
          console.warn("Fallback screenshot download failed", downloadError);
          markFailed(messages.screenshot.copyFailed);
        }
      }
    };

    void copyBlob();
  };

  const download = () => {
    if (isGraphEmpty || downloadState === "saving") {
      return;
    }

    setDownloadState("saving");
    setDownloadMessage("");

    const markFailed = (message: string) => {
      console.warn("Screenshot download failed", message);
      setDownloadMessage(message);
      setDownloadState("failed");
      scheduleDownloadReset();
    };

    const saveBlob = (pngBlob: Blob) => {
      try {
        downloadBlob(
          pngBlob,
          `graph-editor-${formatTimestamp(new Date())}.png`,
        );
        setDownloadState("saved");
        scheduleDownloadReset();
      } catch (error) {
        console.warn("PNG download failed", error);
        markFailed(messages.screenshot.downloadFailed);
      }
    };

    void createBlobForAction()
      .then(saveBlob)
      .catch((error) =>
        markFailed(
          error instanceof Error
            ? error.message
            : messages.screenshot.downloadFailed,
        ),
      );
  };

  const setBackground = (nextBackground: PngExportBackground) => {
    setBackgroundState(nextBackground);
    resetFeedback();
    const nextEffectiveBackground =
      nextBackground === "transparent" ? nextBackground : solidBackground;
    void refreshPreview({ background: nextEffectiveBackground });
  };

  const setPaddingPreset = (nextPreset: PngExportPaddingPreset) => {
    setPaddingPresetState(nextPreset);
    resetFeedback();
    void refreshPreview({
      paddingPx: resolvePaddingPx(nextPreset, customPaddingPx),
    });
  };

  const setCustomPaddingPx = (nextPaddingPx: number) => {
    const paddingPx = clampPaddingPx(nextPaddingPx);
    setPaddingPresetState("custom");
    setCustomPaddingPxState(paddingPx);
    resetFeedback();
    void refreshPreview({ paddingPx });
  };

  const setLongEdgePreset = (nextPreset: PngExportLongEdgePreset) => {
    setLongEdgePresetState(nextPreset);
    resetFeedback();
    void refreshPreview({
      longEdgePx: resolveLongEdgePx(nextPreset, customLongEdgePx),
    });
  };

  const setCustomLongEdgePx = (nextLongEdgePx: number) => {
    const longEdgePx = clampLongEdgePx(nextLongEdgePx);
    setLongEdgePresetState("custom");
    setCustomLongEdgePxState(longEdgePx);
    resetFeedback();
    void refreshPreview({ longEdgePx });
  };

  const setScope = (nextScope: PngExportScope) => {
    setScopeState(nextScope);
    resetFeedback();
    void refreshPreview({ scope: nextScope });
  };

  useEffect(() => {
    if (!previewEnabled || isGraphEmpty || !previewStale) {
      return;
    }

    void refreshPreview();
  }, [currentPreviewInputKey, isGraphEmpty, previewEnabled, previewStale]);

  useEffect(
    () => () => {
      clearTimeoutRef(copyResetTimeoutRef);
      clearTimeoutRef(downloadResetTimeoutRef);
      revokePreviewUrl();
    },
    [],
  );

  return {
    background,
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
    refreshPreview,
    scope,
    setBackground,
    setCustomLongEdgePx,
    setCustomPaddingPx,
    setScope,
    setLongEdgePreset,
    setPaddingPreset,
    solidBackground,
  };
}

function clearTimeoutRef(ref: MutableRefObject<number | null>) {
  if (ref.current === null) {
    return;
  }

  window.clearTimeout(ref.current);
  ref.current = null;
}

function readImageDimensions(url: string) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        height: image.naturalHeight,
        width: image.naturalWidth,
      });
    };
    image.onerror = () => reject(new Error("Could not read PNG dimensions"));
    image.src = url;
  });
}

async function addPngPadding(
  blob: Blob,
  {
    background,
    paddingPx,
  }: {
    background: PngExportBackground;
    paddingPx: number;
  },
) {
  if (paddingPx === 0) {
    return blob;
  }

  const image = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = image.width + paddingPx * 2;
  canvas.height = image.height + paddingPx * 2;

  const context = canvas.getContext("2d");
  if (!context) {
    image.close();
    throw new Error("Could not prepare padded PNG");
  }

  if (background !== "transparent") {
    context.fillStyle = readPaddedPngBackground(background);
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, paddingPx, paddingPx);
  image.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((paddedBlob) => {
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
  return background === "black" ? "#020617" : "#ffffff";
}
