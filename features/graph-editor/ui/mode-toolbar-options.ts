import {
  Circle,
  MousePointer2,
  SplinePointer,
  type LucideIcon,
} from "lucide-react";

import { layoutDefinitions, type LayoutDefinition } from "../layouts";
import type { EditorMode } from "../shell/state/editor-state";

export type ToolbarModeOption = {
  mode: EditorMode;
  keyHint: string;
  accent?: "create" | "connect";
  icon: LucideIcon;
};

export type ToolbarLayoutOption = LayoutDefinition;

export const toolbarModes: ToolbarModeOption[] = [
  {
    mode: "select",
    keyHint: "V",
    icon: MousePointer2,
  },
  {
    mode: "node",
    keyHint: "N",
    accent: "create",
    icon: Circle,
  },
  {
    mode: "edge",
    keyHint: "E",
    accent: "connect",
    icon: SplinePointer,
  },
];

export const toolbarLayouts: readonly ToolbarLayoutOption[] = layoutDefinitions;
