import { atom } from "jotai";

import type { GraphClipboardPayload } from "../../io/clipboard";
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
