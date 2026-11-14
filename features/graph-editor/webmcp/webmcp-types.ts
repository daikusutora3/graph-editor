import type { createStore } from "jotai/vanilla";
import type { GraphModel } from "../core/graph/model";

export type WebMcpToolContext = {
  store: ReturnType<typeof createStore>;
  revision: () => string;
  selectionRevision: () => string;
  requestFit: (graph: GraphModel) => void;
};

export type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
    consequentialHint?: boolean;
  };
  execute: (
    input: unknown,
    options?: { signal: AbortSignal },
  ) => Promise<unknown>;
};
