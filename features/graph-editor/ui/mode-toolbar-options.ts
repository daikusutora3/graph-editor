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
  label: string;
  tooltip: string;
  keyHint: string;
  accent?: "create" | "connect";
  icon: LucideIcon;
};

export type ToolbarLayoutOption = LayoutDefinition;

export const toolbarModes: ToolbarModeOption[] = [
  {
    mode: "select",
    label: "選択",
    tooltip: "頂点や辺を選択・移動",
    keyHint: "V",
    icon: MousePointer2,
  },
  {
    mode: "node",
    label: "頂点",
    tooltip: "キャンバスに頂点を追加",
    keyHint: "N",
    accent: "create",
    icon: Circle,
  },
  {
    mode: "edge",
    label: "辺",
    tooltip: "2つの頂点を辺で接続",
    keyHint: "E",
    accent: "connect",
    icon: SplinePointer,
  },
];

export const toolbarLayouts: readonly ToolbarLayoutOption[] =
  layoutDefinitions.filter(
    (layout) => layout.kind !== "components" && layout.kind !== "spiral",
  );
