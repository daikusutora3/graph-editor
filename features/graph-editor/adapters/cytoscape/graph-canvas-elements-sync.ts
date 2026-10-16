import type {
  Core,
  CollectionReturnValue,
  ElementDefinition,
  SingularElementReturnValue,
} from "cytoscape";
import { decodeCytoscapeId } from "./cytoscape-ids";
import { projectCytoscapeElements } from "./cytoscape-coordinates";

type SyncCytoscapeElementsResult = {
  changedElements: CollectionReturnValue;
  added: number;
  recreated: number;
  removed: number;
  skipped: number;
  updated: number;
};

type SyncCytoscapeElementsOptions = {
  skipNodePositionIds?: ReadonlySet<string>;
};

const TRANSIENT_CLASSES = new Set([
  "edge-source",
  "label-editing",
  "range-preview",
]);

export function syncCytoscapeElements(
  cy: Core,
  elements: ElementDefinition[],
  options: SyncCytoscapeElementsOptions = {},
): SyncCytoscapeElementsResult {
  const projection = projectCytoscapeElements(
    cy,
    elements,
    Boolean(options.skipNodePositionIds?.size),
  );
  elements = projection.elements;
  const result: SyncCytoscapeElementsResult = {
    changedElements: cy.collection(),
    added: 0,
    recreated: 0,
    removed: 0,
    skipped: 0,
    updated: 0,
  };
  if (projection.rebased) result.changedElements.merge(cy.elements());
  const nextIds = new Set(
    elements
      .map((element) => element.data?.id)
      .filter((id): id is string => typeof id === "string"),
  );

  let hasSurvivingEdges = false;
  const removed = cy.elements().filter((element) => {
    if (!nextIds.has(element.id())) return true;
    hasSurvivingEdges ||= element.isEdge();
    return false;
  });
  if (removed.length > 0) {
    // Capture surviving siblings before removal. Expanding once
    // per endpoint pair avoids repeating the same incident-edge scan for every
    // deleted parallel edge.
    // If every old edge disappears, only newly added edges will need geometry.
    if (hasSurvivingEdges) {
      const pairs = new Map<string, Set<string>>();
      const representatives = removed
        .edges()
        .merge(removed.nodes().connectedEdges())
        .filter((edge) => {
          const source = edge.source().id();
          const target = edge.target().id();
          const first = source <= target ? source : target;
          const second = source <= target ? target : source;
          let targets = pairs.get(first);
          if (targets?.has(second)) return false;
          if (!targets) {
            targets = new Set();
            pairs.set(first, targets);
          }
          targets.add(second);
          return true;
        });
      result.changedElements.merge(
        representatives.parallelEdges().not(removed),
      );
    }
    result.removed = removed.length;
    // Keep the established removal order: Cytoscape swaps the core pool's last
    // entry into each deleted slot, which also determines overlay focus order.
    removed.forEach((element) => {
      element.remove();
    });
  }

  for (const definition of elements) {
    const id = definition.data?.id;

    if (typeof id !== "string") {
      continue;
    }

    const existing = cy.getElementById(id);

    if (existing.empty()) {
      result.changedElements.merge(cy.add(definition));
      result.added += 1;
      continue;
    }

    if (shouldRecreateElement(existing, definition)) {
      result.changedElements.merge(
        (existing.group() === "edges"
          ? existing.parallelEdges()
          : existing.connectedEdges().parallelEdges()
        ).not(existing),
      );
      existing.remove();
      result.changedElements.merge(cy.add(definition));
      result.recreated += 1;
      continue;
    }

    if (!shouldUpdateElement(existing, definition, options)) {
      result.skipped += 1;
      continue;
    }

    updateElement(existing, definition, options);
    result.changedElements.merge(existing);
    result.updated += 1;
  }

  return result;
}

function shouldRecreateElement(
  element: SingularElementReturnValue,
  definition: ElementDefinition,
) {
  if (definition.group === "nodes") {
    return !element.isNode();
  }

  if (definition.group === "edges") {
    if (!element.isEdge()) {
      return true;
    }

    return (
      element.data("source") !== definition.data?.source ||
      element.data("target") !== definition.data?.target
    );
  }

  return false;
}

function updateElement(
  element: SingularElementReturnValue,
  definition: ElementDefinition,
  options: SyncCytoscapeElementsOptions,
) {
  const nextData = definition.data ?? {};

  for (const key of Object.keys(element.data())) {
    if (!(key in nextData)) {
      element.removeData(key);
    }
  }

  element.data(nextData);
  element.classes(
    mergeModelAndTransientClasses(element.classes(), definition.classes ?? ""),
  );

  if (
    element.isNode() &&
    definition.position &&
    !options.skipNodePositionIds?.has(decodeCytoscapeId(element.id()))
  ) {
    element.position(definition.position);
  }
}

function shouldUpdateElement(
  element: SingularElementReturnValue,
  definition: ElementDefinition,
  options: SyncCytoscapeElementsOptions,
) {
  if (!sameModelClasses(element.classes(), definition.classes ?? "")) {
    return true;
  }

  if (!sameElementData(element.data(), definition.data ?? {})) {
    return true;
  }

  if (!element.isNode()) {
    return false;
  }

  const nextPosition = definition.position;

  if (
    !nextPosition ||
    options.skipNodePositionIds?.has(decodeCytoscapeId(element.id()))
  ) {
    return false;
  }

  const currentPosition = element.position();
  return (
    currentPosition.x !== nextPosition.x || currentPosition.y !== nextPosition.y
  );
}

function sameElementData(
  current: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);

  return (
    currentKeys.length === nextKeys.length &&
    currentKeys.every((key) => {
      const a = current[key],
        b = next[key];
      return (
        a === b ||
        (Array.isArray(a) &&
          Array.isArray(b) &&
          a.length === b.length &&
          a.every((value, index) => value === b[index]))
      );
    })
  );
}

function sameModelClasses(current: string | string[], next: string | string[]) {
  const currentClasses = classList(current).filter(
    (className) => !TRANSIENT_CLASSES.has(className),
  );
  const nextClasses = classList(next);

  return sameClassSet(currentClasses, nextClasses);
}

function mergeModelAndTransientClasses(
  current: string | string[],
  nextModelClasses: string | string[],
) {
  const nextClasses = classList(nextModelClasses);
  const merged = new Set(nextClasses);

  for (const className of classList(current)) {
    if (TRANSIENT_CLASSES.has(className)) {
      merged.add(className);
    }
  }

  return [...merged].join(" ");
}

function sameClassSet(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }

  const bSet = new Set(b);
  return a.every((className) => bSet.has(className));
}

function classList(classes: string | string[]) {
  const raw = Array.isArray(classes) ? classes.join(" ") : classes;

  return raw.split(/\s+/).filter(Boolean);
}
