import type { GraphModel } from "../core/graph/model";

export type ImportResult = {
  model: GraphModel;
  warnings: string[];
  format?: string;
};
