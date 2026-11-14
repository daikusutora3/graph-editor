import type {
  GraphModel,
  GraphSettings,
} from "../../features/graph-editor/core/graph/model";
import {
  normalizeSampleParameters,
  type SampleParameterValues,
} from "../../features/graph-editor/samples/sample-parameters";
import {
  createParameterizedSampleGraph,
  type SampleGraphKind,
} from "../../features/graph-editor/samples/sample-graphs";

export function createConfiguredSampleGraph(
  kind: SampleGraphKind,
  values: SampleParameterValues = {},
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createParameterizedSampleGraph(
    kind,
    normalizeSampleParameters(kind, values),
    settings,
  );
}
