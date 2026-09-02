"use client";

import { useAtom, useSetAtom } from "jotai";
import {
  Circle,
  MousePointer2,
  SplinePointer,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useLayoutEffect, type RefObject } from "react";

import {
  editorLayoutAtom,
  editorPanelAtom,
} from "../../shell/state/editor-atoms";
import {
  resolveEditorLayout,
  toggleEditorPanel,
  type EditorPanel,
} from "../../shell/state/editor-layout";
import type { EditorMode } from "../../shell/state/editor-state";
import { usePresence } from "../hooks/use-panel-presence";

export type EditorModeOption = {
  mode: EditorMode;
  keyHint: string;
  icon: LucideIcon;
};

export const editorModes: readonly EditorModeOption[] = [
  { mode: "select", keyHint: "V", icon: MousePointer2 },
  { mode: "node", keyHint: "N", icon: Circle },
  { mode: "edge", keyHint: "E", icon: SplinePointer },
];

export function useEditorLayoutObserver(ref: RefObject<HTMLElement | null>) {
  const setLayout = useSetAtom(editorLayoutAtom);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const update = () => {
      setLayout(resolveEditorLayout(element.getBoundingClientRect().width));
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref, setLayout]);
}

export function useEditorPanel() {
  const [panel, setPanel] = useAtom(editorPanelAtom);
  const presence = usePresence(panel);
  const toggle = useCallback(
    (next: EditorPanel) => {
      setPanel((current) => toggleEditorPanel(current, next));
    },
    [setPanel],
  );
  const open = useCallback(
    (next: EditorPanel) => {
      setPanel(next);
    },
    [setPanel],
  );
  const close = useCallback(() => {
    setPanel(null);
  }, [setPanel]);

  return { close, open, panel, presence, setPanel, toggle };
}
