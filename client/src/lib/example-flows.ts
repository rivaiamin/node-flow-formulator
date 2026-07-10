import type { Edge, Node } from "reactflow";
import type { NodeData } from "./flow-utils";

/**
 * Real smak1penabur report-card calculations, expressed as flows that run in
 * this editor and match the AIMSIS engine.
 *
 * - kog_score / psi_score  : Stage-0 subject finals (final_pengetahuan /
 *   final_keterampilan). Components → per-type headers (Level A, weighted by the
 *   component weight) → weighted by the KKM percentages (Level B). Verified 100%
 *   vs the legacy grade math on the real smak1penabur DB.
 * - merged_subjects        : averages subjects that share a `combined_name`
 *   (the legacy `sub_include` behaviour, e.g. Lintas Minat).
 */

export interface ExampleFlow {
  id: string;
  name: string;
  description: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
  /** Expected finalOutput when run — used by verify-flow.ts. */
  expected: number | Record<string, number>;
}

// Stage-0 subject-final flow (kog_score and psi_score share this exact shape;
// only the weight field, the two datasets, and the output name differ).
function finalScoreFlow(opts: {
  outputName: string;
  weightField: string; // w_peng | w_ket
  inputsDataset: string; // score_inputs
  inputs: any[];
  pctDataset: string; // pct_pengetahuan | pct_keterampilan
  pct: Record<string, number>;
}): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodes: Node<NodeData>[] = [
    { id: "n1", type: "source", position: { x: 0, y: 80 },
      data: { label: opts.inputsDataset, dataset: opts.inputsDataset, json: JSON.stringify(opts.inputs, null, 2) } },
    { id: "n2", type: "group_by", position: { x: 360, y: 130 },
      data: { label: "Group by type", field: "type" } },
    { id: "n3", type: "aggregate_groups", position: { x: 660, y: 90 },
      data: { label: "Level A (type headers)", op: "weighted_average", value: "score_eff", weight: opts.weightField, onEmpty: "drop" } },
    { id: "n4", type: "source", position: { x: 660, y: 400 },
      data: { label: opts.pctDataset, dataset: opts.pctDataset, json: JSON.stringify(opts.pct, null, 2) } },
    { id: "n5", type: "combine_by_key", position: { x: 990, y: 200 },
      data: { label: "Level B (× KKM %)", op: "weighted_average" } },
    { id: "n6", type: "round", position: { x: 1300, y: 220 }, data: { label: "Round", precision: 2 } },
    { id: "n7", type: "output", position: { x: 1560, y: 200 }, data: { label: opts.outputName, name: opts.outputName } },
  ];
  const edges: Edge[] = [
    { id: "e1", source: "n1", target: "n2", targetHandle: "rows" },
    { id: "e2", source: "n2", target: "n3", targetHandle: "groups" },
    { id: "e3", source: "n3", target: "n5", targetHandle: "values" },
    { id: "e4", source: "n4", target: "n5", targetHandle: "weights" },
    { id: "e5", source: "n5", target: "n6", targetHandle: "value" },
    { id: "e6", source: "n6", target: "n7", targetHandle: "value" },
  ];
  return { nodes, edges };
}

// score_percentage rows (Pengetahuan / Keterampilan) — need not sum to 100.
const PCT_PENGETAHUAN = { Sikap: 10, UTS: 15, UAS: 15, Tugas: 25, Ulangan: 25, LainLain: 10 };
const PCT_KETERAMPILAN = { Sikap: 10, UTS: 15, UAS: 15, Tugas: 25, Ulangan: 25, LainLain: 10 };

const kogFlow = finalScoreFlow({
  outputName: "kog_score",
  weightField: "w_peng",
  inputsDataset: "score_inputs",
  inputs: [
    { type: "Tugas", score_eff: 80, w_peng: 1 },
    { type: "Tugas", score_eff: 90, w_peng: 1 },
    { type: "Ulangan", score_eff: 78, w_peng: 2 },
    { type: "Sikap", score_eff: 85, w_peng: 1 },
    { type: "UTS", score_eff: 70, w_peng: 1 },
    { type: "UAS", score_eff: 76, w_peng: 1 },
  ],
  pctDataset: "pct_pengetahuan",
  pct: PCT_PENGETAHUAN,
});

const psiFlow = finalScoreFlow({
  outputName: "psi_score",
  weightField: "w_ket",
  inputsDataset: "score_inputs",
  inputs: [
    { type: "Tugas", score_eff: 88, w_ket: 1 },
    { type: "Tugas", score_eff: 92, w_ket: 1 },
    { type: "Ulangan", score_eff: 80, w_ket: 2 },
    { type: "Sikap", score_eff: 90, w_ket: 1 },
    { type: "UTS", score_eff: 75, w_ket: 1 },
    { type: "UAS", score_eff: 82, w_ket: 1 },
  ],
  pctDataset: "pct_keterampilan",
  pct: PCT_KETERAMPILAN,
});

// Merged-subject averaging (the legacy `sub_include` case): subjects that share
// a `combined_name` are averaged into one printed value (e.g. Lintas Minat).
const MERGED_SUBJECTS = [
  { subject: "LM Bahasa Mandarin", combined_name: "Lintas Minat", final: 85 },
  { subject: "LM Bahasa Jepang", combined_name: "Lintas Minat", final: 79 },
  { subject: "Matematika (Umum)", combined_name: "Matematika", final: 88 },
];
const mergedFlow: { nodes: Node<NodeData>[]; edges: Edge[] } = {
  nodes: [
    { id: "m1", type: "source", position: { x: 0, y: 120 },
      data: { label: "subject_finals", dataset: "subject_finals", json: JSON.stringify(MERGED_SUBJECTS, null, 2) } },
    { id: "m2", type: "group_by", position: { x: 380, y: 140 },
      data: { label: "Group by combined_name", field: "combined_name" } },
    { id: "m3", type: "aggregate_groups", position: { x: 720, y: 120 },
      data: { label: "Average merged", op: "average", value: "final", onEmpty: "drop" } },
    { id: "m4", type: "output", position: { x: 1060, y: 130 },
      data: { label: "combined_finals", name: "combined_finals" } },
  ],
  edges: [
    { id: "me1", source: "m1", target: "m2", targetHandle: "rows" },
    { id: "me2", source: "m2", target: "m3", targetHandle: "groups" },
    { id: "me3", source: "m3", target: "m4", targetHandle: "value" },
  ],
};

export const smakExamples: ExampleFlow[] = [
  {
    id: "kog_score",
    name: "Knowledge score — kog_score",
    description: "final_pengetahuan: components → type headers (Level A) → weighted by KKM % (Level B) → 79.06.",
    nodes: kogFlow.nodes, edges: kogFlow.edges, expected: 79.06,
  },
  {
    id: "psi_score",
    name: "Skill score — psi_score",
    description: "final_keterampilan: same shape, weighted by keterampilan_weight + pct_keterampilan → 83.39.",
    nodes: psiFlow.nodes, edges: psiFlow.edges, expected: 83.39,
  },
  {
    id: "merged_subjects",
    name: "Merged subjects — Lintas Minat",
    description: "Averages subjects sharing a combined_name (legacy sub_include) → { Lintas Minat: 82, Matematika: 88 }.",
    nodes: mergedFlow.nodes, edges: mergedFlow.edges, expected: { "Lintas Minat": 82, Matematika: 88 },
  },
];

// Back-compat: the primary example (used by verify-flow.ts and the e2e suite).
export const kogScoreExample = { nodes: kogFlow.nodes, edges: kogFlow.edges };
