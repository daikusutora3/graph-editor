"use client";

import { useLayoutEffect, useState } from "react";

export type ShortcutPlatform = "mac" | "other" | "touch";

export function useShortcutPlatform() {
  const [platform, setPlatform] = useState<ShortcutPlatform>("other");

  useLayoutEffect(() => {
    setPlatform(
      shortcutPlatformValue(
        navigator.platform,
        navigator.userAgent,
        navigator.maxTouchPoints,
      ),
    );
  }, []);

  return platform;
}

export function isMacShortcutPlatformValue(
  platform: string | undefined,
  userAgent: string | undefined,
  maxTouchPoints?: number,
) {
  return shortcutPlatformValue(platform, userAgent, maxTouchPoints) === "mac";
}

export function shortcutPlatformValue(
  platform: string | undefined,
  userAgent: string | undefined,
  maxTouchPoints = 0,
): ShortcutPlatform {
  const platformText = platform ?? "";
  const userAgentText = userAgent ?? "";

  if (
    /iPhone|iPad|iPod|Android/i.test(`${platformText} ${userAgentText}`) ||
    (/Mac/i.test(platformText) && maxTouchPoints > 1)
  ) {
    return "touch";
  }

  return /Mac/i.test(platformText || userAgentText) ? "mac" : "other";
}

export function formatModifierShortcut(
  platform: ShortcutPlatform,
  key: string,
  { shift = false }: { shift?: boolean } = {},
) {
  if (platform === "mac") {
    return `${shift ? "⇧" : ""}⌘${key}`;
  }

  return `Ctrl+${shift ? "Shift+" : ""}${key}`;
}
