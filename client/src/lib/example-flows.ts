import type { Edge, Node } from "reactflow";
import type { NodeData } from "./flow-utils";

/**
 * Reference flow: AIMSIS report-card `kog_score` (knowledge score).
 *
 *   source(score_inputs) -> group_by(type) -> aggregate_groups(weighted_average)
 *                                                   \
 *                                                    combine_by_key -> round(2) -> output
 *                                                   /
 *   source(pct_pengetahuan) ------------------------
 *
 * Nothing about the school's components is hardcoded: the types are discovered
 * from the data, and an absent header (LainLain here) drops out of BOTH the
 * numerator and the divisor because combine_by_key intersects keys.
 *
 * Expected result: kog_score = 79.06   (see verify-flow.ts)
 */

const SCORE_INPUTS = [
  { type: "Tugas", score_eff: 80, w_peng: 1 },
  { type: "Tugas", score_eff: 90, w_peng: 1 },
  { type: "Ulangan", score_eff: 78, w_peng: 2 },
  { type: "Sikap", score_eff: 85, w_peng: 1 },
  { type: "UTS", score_eff: 70, w_peng: 1 },
  { type: "UAS", score_eff: 76, w_peng: 1 },
];

const PCT_PENGETAHUAN = { Sikap: 10, UTS: 15, UAS: 15, Tugas: 25, Ulangan: 25, LainLain: 10 };

export const kogScoreExample: { nodes: Node<NodeData>[]; edges: Edge[] } = {
  nodes: [
    {
      id: "n1", type: "source", position: { x: 0, y: 80 },
      data: { label: "Score inputs", dataset: "score_inputs", json: JSON.stringify(SCORE_INPUTS, null, 2) },
    },
    {
      id: "n2", type: "group_by", position: { x: 360, y: 130 },
      data: { label: "Group by type", field: "type" },
    },
    {
      id: "n3", type: "aggregate_groups", position: { x: 660, y: 90 },
      data: { label: "Level A", op: "weighted_average", value: "score_eff", weight: "w_peng", onEmpty: "drop" },
    },
    {
      id: "n4", type: "source", position: { x: 660, y: 400 },
      data: { label: "Pengetahuan weights", dataset: "pct_pengetahuan", json: JSON.stringify(PCT_PENGETAHUAN, null, 2) },
    },
    {
      id: "n5", type: "combine_by_key", position: { x: 990, y: 200 },
      data: { label: "Level B", op: "weighted_average" },
    },
    {
      id: "n6", type: "round", position: { x: 1300, y: 220 },
      data: { label: "Round", precision: 2 },
    },
    {
      id: "n7", type: "output", position: { x: 1560, y: 200 },
      data: { label: "kog_score", name: "kog_score" },
    },
  ],
  edges: [
    { id: "e1", source: "n1", target: "n2", targetHandle: "rows" },
    { id: "e2", source: "n2", target: "n3", targetHandle: "groups" },
    { id: "e3", source: "n3", target: "n5", targetHandle: "values" },
    { id: "e4", source: "n4", target: "n5", targetHandle: "weights" },
    { id: "e5", source: "n5", target: "n6", targetHandle: "value" },
    { id: "e6", source: "n6", target: "n7", targetHandle: "value" },
  ],
};
