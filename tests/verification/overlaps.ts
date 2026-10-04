import { createHash } from "node:crypto";

import {
  nodeGeometryWidth,
  NODE_SIZE_PX,
} from "../../features/graph-editor/core/graph/node-size";
import {
  createOverlapTask,
  OVERLAP_GAP_PX,
  resolveNodeOverlaps,
} from "../../features/graph-editor/layouts/resolve-node-overlaps";
import { overlapVerificationFixtures } from "../fixtures/overlaps";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Overlap");
// Captured from the original all-pairs implementation, before the Y sweep.
// These protect exact coordinates, statuses and node ordering together.
const originalSignatures = [
  "261ed87882426da0b798fab1dbb4b1c7fa89a55746f96e49fa19aea941e517fc",
  "3dea60c20275eb8cbd72e8cc0ecd111dfa002d47bc5e066b3f088c15aa442951",
  "6c591a4b964526cc42b7e30d581a074335fc8ce149a23521c0cbd709f7b97fa8",
  "774014f45b9de3d24b80cc1262db78933846e92b94feadf902cd2f8d1a6e6f04",
  "88ef707992ff53b1f5877d846ebadf2ddfbf1b8a45151e79f14a723704fd9cad",
  "6cb3334d93655742551754dea4b1c601ba6215cb1c369303a0b01895cc1de485",
  "4cbcf0d9370cdef7629c79094abdafbeda6d2658d2badcfac473eebe724fdede",
  "c2c026cce2efc3c14503cb3c8b362fe78fa621de5d678d268174d049213e77ba",
  "bbc53355ec7d2ef7572c9796ca273ae6466a4e370cdd30e396ecbaf0cfa5b4f4",
  "bbc53355ec7d2ef7572c9796ca273ae6466a4e370cdd30e396ecbaf0cfa5b4f4",
  "0dec90854a2579c75a7903cf91a9c7ca6cbca4fb8cbc85fa2381ea346aa8a7e2",
  "0dec90854a2579c75a7903cf91a9c7ca6cbca4fb8cbc85fa2381ea346aa8a7e2",
  "4136d45147ef1a6f22b605b37128b24667054209ce77afbf4f17bec79d16a536",
  "cb0f3792f6994947fcb58382f8f4a1ad51133639a76d59b8445395d00b8b19fa",
  "27ea80b46c4f2726667155dc416d14a13866bff3e6d3f1669a399f20e1c49fae",
  "421fb3420bf4dff60756da60619ee13e0d60eaed41f31cf2bec6be1ab48ae452",
  "1248c923a5876690aaecd16ee26478060a7dc12b387d3bd7afbbd2c1ae223098",
  "0d057d113dd60deefc73ba8a3f728e200b94a09bbdb1274418242d416309ea3f",
];
expect(
  originalSignatures.length === overlapVerificationFixtures.length,
  "every equivalence fixture has an original signature",
);

for (const [index, [name, graph]] of overlapVerificationFixtures.entries()) {
  const input = JSON.stringify(graph);
  const result = resolveNodeOverlaps(graph);
  const signature = createHash("sha256")
    .update(JSON.stringify(result))
    .digest("hex");
  expect(
    signature === originalSignatures[index],
    `${name}: exact output matches the original resolver`,
  );
  expect(JSON.stringify(graph) === input, `${name}: input is not mutated`);
  expect(result.remainingPairs === 0, `${name}: every collision is resolved`);

  const required = NODE_SIZE_PX + OVERLAP_GAP_PX;
  for (let first = 0; first < graph.nodes.length; first++) {
    const a = graph.nodes[first]!;
    const pointA = result.positions[a.id]!;
    const spanA = Math.max(
      0,
      (nodeGeometryWidth({
        ...a,
        label: graph.settings.showNodeLabels ? a.label : "",
      }) -
        NODE_SIZE_PX) /
        2,
    );
    if (graph.settings.snapToGrid) {
      expect(
        pointA.x % 24 === 0 && pointA.y % 24 === 0,
        `${name}: resolved positions stay on the grid`,
      );
    }
    for (let second = first + 1; second < graph.nodes.length; second++) {
      const b = graph.nodes[second]!;
      const pointB = result.positions[b.id]!;
      const spanB = Math.max(
        0,
        (nodeGeometryWidth({
          ...b,
          label: graph.settings.showNodeLabels ? b.label : "",
        }) -
          NODE_SIZE_PX) /
          2,
      );
      expect(
        Math.hypot(
          Math.max(0, Math.abs(pointB.x - pointA.x) - spanA - spanB),
          pointB.y - pointA.y,
        ) >=
          required - 0.00001,
        `${name}: pill boundaries have the required clearance`,
      );
    }
  }
  const again = resolveNodeOverlaps({
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      ...result.positions[node.id],
    })),
  });
  expect(
    again.status === "unchanged" &&
      JSON.stringify(again.positions) === JSON.stringify(result.positions),
    `${name}: resolving twice does not move nodes again`,
  );

  const task = createOverlapTask(graph);
  let step = task.next();
  while (!step.done) step = task.next();
  expect(
    JSON.stringify(step.value) === JSON.stringify(result),
    `${name}: resumable and synchronous calculations agree`,
  );
}

finish(
  `Overlap verification passed (${overlapVerificationFixtures.length} fixtures)`,
);
