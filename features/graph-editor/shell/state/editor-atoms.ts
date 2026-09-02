import { atom } from "jotai";

import type { GraphClipboardPayload } from "../../io/clipboard";
import type { EditorLayout, EditorPanel } from "./editor-layout";
import {
  createEmptyEdgeDraft,
  createEmptySelection,
  type EdgeDraft,
  type EditorMode,
  type SelectionState,
} from "./editor-state";

export const selectionAtom = atom<SelectionState>(createEmptySelection());

export const editorModeAtom = atom<EditorMode>("select");

export const edgeDraftAtom = atom<EdgeDraft>(createEmptyEdgeDraft());

export const graphClipboardAtom = atom<GraphClipboardPayload | null>(null);

export const graphPasteCountAtom = atom(0);

export const editorLayoutAtom = atom<EditorLayout>("desktop");

export const editorPanelAtom = atom<EditorPanel | null>(null);
