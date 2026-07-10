import _ from "lodash";
import * as XLSX from "xlsx";

/**
 * Flow execution engine — shared by the React client and the HTTP run API.
 *
 * Mirrors the AIMSIS PHP GraphEvaluatorService on the same canonical graph
 * (docs/calculation-graph-editor-contract.md + calculation-graph-node-model.md).
 *
 * Value types a wire can carry:
 *   Scalar     number/string (final scores, weights)
 *   RowSet     any[]                 (rows from a source / filter / sort / limit / excel)
 *   Grouped    { key -> RowSet }     (output of group_by)
 *   ScalarMap  { key -> number }     (output of aggregate_groups / extrema / an object source)
 *
 * Execution is a proper topological sort (Kahn), so a node with two parents
 * (e.g. combine_by_key) only runs after BOTH parents. Inputs are resolved by the
 * edge's `targetHandle` (the slot name), which is what makes multi-input nodes
 * possible. Fail-loud: a node that can't produce a value records an error and
 * yields nothing, so downstream nodes fail on the missing input.
 */

export type RowSet = any[];
export type Grouped = Record<string, any[]>;
export type ScalarMap = Record<string, number>;
export type FlowValue = number | string | boolean | RowSet | Grouped | ScalarMap | null | undefined;
export type FlowData = unknown[]; // legacy alias

export interface NodeData {
  label: string;
  // source (collection) — a named dataset provided at run time
  dataset?: string;
  json?: string;
  // excel source
  excelBase64?: string;
  excelSheet?: string;
  excelHeaderRow?: boolean;
  // filter
  field?: string;
  operator?: "==" | "!=" | ">" | "<" | "contains";
  value?: string | number; // filter: compare value · aggregate_groups: value-field name
  // legacy stats
  operation?: "count" | "sum" | "avg";
  // collection aggregate / combine
  op?: "weighted_average" | "weighted_sum" | "sum" | "average" | "count" | "min" | "max";
  weight?: string; // aggregate_groups: weight-field name
  onEmpty?: string; // "drop" | numeric string
  // round
  precision?: number | string;
  // output
  name?: string;
  // sort / limit / extrema
  sortField?: string;
  sortDirection?: "asc" | "desc";
  limit?: number;
  extrema?: "min" | "max" | "both";
  // execution result (injected during run)
  result?: FlowValue;
  error?: string;
}

/** Minimal node shape for execution (React Flow–compatible, but not React-dependent). */
export interface SerializableFlowNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data: NodeData;
}

export interface SerializableFlowEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface ExecuteFlowOptions {
  /** Legacy single-source override: a root source with no bound dataset uses this. */
  inputOverride?: unknown;
  /** Named datasets for `source` nodes (the collection model). */
  datasets?: Record<string, FlowValue>;
}

export interface ExecuteFlowResult {
  nodes: SerializableFlowNode[];
  /** Value at the graph's `output` (or legacy `resultNode`), else the last node's output. */
  finalOutput: unknown;
}

// ---------------------------------------------------------------------------
// Port types — used by the editor to reject invalid wiring before you run.
// ---------------------------------------------------------------------------

export type PortType = "rowset" | "grouped" | "scalarmap" | "scalar" | "any";

export const NODE_PORTS: Record<string, { out: PortType; in: Record<string, PortType> }> = {
  source: { out: "any", in: {} }, // RowSet or ScalarMap depending on the dataset
  excel_input: { out: "rowset", in: {} },
  filter: { out: "rowset", in: { rows: "rowset" } },
  sort: { out: "rowset", in: { rows: "rowset" } },
  limit: { out: "rowset", in: { rows: "rowset" } },
  group_by: { out: "grouped", in: { rows: "rowset" } },
  aggregate_groups: { out: "scalarmap", in: { groups: "grouped" } },
  extrema: { out: "scalarmap", in: { rows: "rowset" } },
  combine_by_key: { out: "scalar", in: { values: "scalarmap", weights: "scalarmap" } },
  round: { out: "scalar", in: { value: "scalar" } },
  output: { out: "any", in: { value: "any" } },
};

export const portsCompatible = (a: PortType, b: PortType): boolean =>
  a === "any" || b === "any" || a === b;

class FlowError extends Error {}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export function executeFlow(
  nodes: SerializableFlowNode[],
  edges: SerializableFlowEdge[],
  options: ExecuteFlowOptions = {}
): ExecuteFlowResult {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n, data: { ...n.data } }]));
  const datasets = options.datasets ?? {};

  // ---- Topological order (Kahn) — correct for multi-parent nodes ----
  const indeg = new Map<string, number>();
  nodes.forEach((n) => indeg.set(n.id, 0));
  edges.forEach((e) => indeg.set(e.target, (indeg.get(e.target) || 0) + 1));

  const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    edges
      .filter((e) => e.source === id)
      .forEach((e) => {
        const d = (indeg.get(e.target) || 0) - 1;
        indeg.set(e.target, d);
        if (d === 0) queue.push(e.target);
      });
  }

  const results = new Map<string, FlowValue>();

  // Inputs keyed by the edge's targetHandle (slot). Legacy single-input edges
  // (no handle) land in "value".
  const inputsOf = (nodeId: string): Record<string, FlowValue | undefined> => {
    const map: Record<string, FlowValue | undefined> = {};
    edges
      .filter((e) => e.target === nodeId)
      .forEach((e) => {
        const slot = e.targetHandle || "value";
        map[slot] = results.get(e.source);
      });
    return map;
  };
  // First incoming edge's value — the legacy "first parent" convention.
  const firstInputOf = (nodeId: string): FlowValue | undefined => {
    const e = edges.find((ed) => ed.target === nodeId);
    return e ? results.get(e.source) : undefined;
  };

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId)!;
    try {
      const inp = inputsOf(nodeId);
      const first = firstInputOf(nodeId);
      const pick = (slot: string) => (inp[slot] !== undefined ? inp[slot] : first);
      let out: FlowValue;

      switch (node.type) {
        // ---- collection model (report-card) ----
        case "source":
          out = execSource(node.data, datasets, options.inputOverride);
          break;
        case "excel_input":
        case "excelInputNode":
          out = execExcel(node.data);
          break;
        case "filter":
        case "filterNode":
          out = execFilter(node.data, reqRowSet(pick("rows"), node, "rows"));
          break;
        case "sort":
        case "sortNode":
          out = execSort(node.data, reqRowSet(pick("rows"), node, "rows"));
          break;
        case "limit":
        case "limitNode":
          out = execLimit(node.data, reqRowSet(pick("rows"), node, "rows"));
          break;
        case "group_by":
        case "groupNode":
          out = execGroupBy(node.data, reqRowSet(pick("rows"), node, "rows"));
          break;
        case "aggregate_groups":
          out = execAggregateGroups(node.data, reqGrouped(pick("groups"), node, "groups"));
          break;
        case "extrema":
        case "extremaNode":
          out = execExtrema(node.data, reqRowSet(pick("rows"), node, "rows"));
          break;
        case "combine_by_key":
          out = execCombineByKey(
            node.data,
            reqMap(inp.values, node, "values"),
            reqMap(inp.weights, node, "weights")
          );
          break;
        case "round":
          out = round(num(pick("value"), node, "value"), toInt(node.data.precision, 0));
          break;
        case "output":
        case "resultNode":
          if (pick("value") === undefined) throw new FlowError("output: missing input 'value'");
          out = pick("value");
          break;

        // ---- legacy compatibility (kept so old flows / API runs still execute) ----
        case "inputNode":
          out = execLegacyInput(node.data, options.inputOverride);
          break;
        case "statsNode":
          out = execLegacyStats(node.data, asArray(first));
          break;

        default:
          throw new FlowError(`Unknown node type '${node.type}'`);
      }

      results.set(nodeId, out);
      nodeMap.set(nodeId, { ...node, data: { ...node.data, result: out, error: undefined } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      nodeMap.set(nodeId, { ...node, data: { ...node.data, error: message, result: undefined } });
      // do not set results[nodeId] — downstream fails loud
    }
  }

  const orderedNodes = nodes.map((n) => nodeMap.get(n.id)!);

  // finalOutput: last `output`/`resultNode` in execution order, else last node.
  let finalOutput: unknown = undefined;
  for (let i = order.length - 1; i >= 0; i--) {
    const t = nodeMap.get(order[i]!)!.type;
    if (t === "output" || t === "resultNode") {
      finalOutput = results.get(order[i]!);
      break;
    }
  }
  if (finalOutput === undefined && order.length > 0) {
    finalOutput = results.get(order[order.length - 1]!);
  }

  return { nodes: orderedNodes, finalOutput };
}

// ---------------------------------------------------------------------------
// Node implementations
// ---------------------------------------------------------------------------

function execSource(data: NodeData, datasets: Record<string, FlowValue>, inputOverride: unknown): FlowValue {
  if (data.dataset && Object.prototype.hasOwnProperty.call(datasets, data.dataset)) {
    return datasets[data.dataset];
  }
  if (inputOverride !== undefined) {
    return inputOverride as FlowValue; // legacy API single-source override
  }
  const raw = (data.json ?? "").trim();
  if (!raw) throw new FlowError(`source: no dataset '${data.dataset ?? ""}' provided and no sample JSON`);
  try {
    return JSON.parse(raw);
  } catch {
    throw new FlowError("source: invalid JSON");
  }
}

function execExcel(data: NodeData): RowSet {
  const base64 = data.excelBase64;
  if (!base64) throw new FlowError("excel_input: no file loaded");
  return parseExcelToRows(base64, data.excelSheet, data.excelHeaderRow ?? true);
}

function execFilter(data: NodeData, rows: RowSet): RowSet {
  const { field, operator, value } = data;
  if (!field || !operator) return rows;
  const cv = value !== undefined && value !== "" && !isNaN(Number(value)) ? Number(value) : value;
  return rows.filter((item) => {
    const iv = _.get(item, field);
    switch (operator) {
      case "==": return iv == cv;
      case "!=": return iv != cv;
      case ">": return Number(iv) > Number(cv);
      case "<": return Number(iv) < Number(cv);
      case "contains": return String(iv).includes(String(cv));
      default: return true;
    }
  });
}

function execSort(data: NodeData, rows: RowSet): RowSet {
  const field = data.sortField;
  if (!field) return rows;
  const factor = (data.sortDirection ?? "asc") === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = _.get(a, field);
    const bv = _.get(b, field);
    const aNil = av === null || av === undefined;
    const bNil = bv === null || bv === undefined;
    if (aNil && bNil) return 0;
    if (aNil) return 1;
    if (bNil) return -1;
    const an = typeof av === "number" ? av : Number(av);
    const bn = typeof bv === "number" ? bv : Number(bv);
    if (Number.isFinite(an) && Number.isFinite(bn)) return (an - bn) * factor;
    return String(av).localeCompare(String(bv)) * factor;
  });
}

function execLimit(data: NodeData, rows: RowSet): RowSet {
  const n = data.limit;
  const limit = typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return rows.slice(0, limit);
}

function execGroupBy(data: NodeData, rows: RowSet): Grouped {
  const field = data.field;
  if (!field) throw new FlowError("group_by: 'field' (group key) is required");
  return _.groupBy(rows, (r) => String(_.get(r, field)));
}

function execAggregateGroups(data: NodeData, groups: Grouped): ScalarMap {
  const op = (data.op as string) || "sum";
  const valueField = data.value as string | undefined;
  const weightField = data.weight;
  const out: ScalarMap = {};

  for (const key of Object.keys(groups)) {
    const rows = groups[key] || [];
    if (op === "count") { out[key] = rows.length; continue; }
    if (rows.length === 0) {
      const e = handleEmpty(data.onEmpty);
      if (e !== null) out[key] = e;
      continue;
    }
    if (!valueField) throw new FlowError("aggregate_groups: 'value' (field name) is required");
    const values = rows.map((r) => Number(_.get(r, valueField)) || 0);
    const weights = weightField ? rows.map((r) => Number(_.get(r, weightField)) || 0) : rows.map(() => 1);

    let res: number | null;
    switch (op) {
      case "sum": res = _.sum(values); break;
      case "average": res = _.mean(values); break;
      case "min": res = Math.min(...values); break;
      case "max": res = Math.max(...values); break;
      case "weighted_sum": res = values.reduce((a, v, i) => a + v * weights[i], 0); break;
      case "weighted_average": {
        const sw = _.sum(weights);
        res = sw === 0 ? handleEmpty(data.onEmpty) : values.reduce((a, v, i) => a + v * weights[i], 0) / sw;
        break;
      }
      default: throw new FlowError(`aggregate_groups: unknown op '${op}'`);
    }
    if (res !== null) out[key] = res;
  }
  return out;
}

function execExtrema(data: NodeData, rows: RowSet): ScalarMap {
  const field = data.field;
  if (!field) throw new FlowError("extrema: 'field' is required");
  const mode = data.extrema ?? "both";
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    const v = Number(_.get(r, field));
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const out: ScalarMap = {};
  if (mode === "min" || mode === "both") out[`${field}_min`] = Number.isFinite(min) ? min : 0;
  if (mode === "max" || mode === "both") out[`${field}_max`] = Number.isFinite(max) ? max : 0;
  return out;
}

function execCombineByKey(data: NodeData, values: ScalarMap, weights: ScalarMap): number {
  const op = (data.op as string) || "weighted_average";
  const keys = Object.keys(values).filter((k) => Object.prototype.hasOwnProperty.call(weights, k));
  if (keys.length === 0) throw new FlowError("combine_by_key: no shared keys between values and weights");
  let numer = 0;
  let denom = 0;
  for (const k of keys) {
    numer += Number(values[k]) * Number(weights[k]);
    denom += Number(weights[k]);
  }
  if (op === "weighted_sum") return numer;
  if (denom === 0) throw new FlowError("combine_by_key: zero weight-sum over shared keys");
  return numer / denom;
}

// ---- legacy node bodies (kept for backward compatibility) ----

function execLegacyInput(data: NodeData, inputOverride: unknown): RowSet {
  if (inputOverride !== undefined) return normalizeInputOverride(inputOverride);
  try {
    const parsed = JSON.parse(data.json || "[]");
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    throw new FlowError("Invalid JSON input");
  }
}

function execLegacyStats(data: NodeData, rows: RowSet): RowSet {
  const { field, operation } = data;
  if (!field || !operation) return rows;
  const isGrouped = rows.length > 0 && Array.isArray((rows[0] as { items?: unknown })?.items);
  const reduce = (vals: number[]) =>
    operation === "sum" ? _.sum(vals) : operation === "avg" ? _.mean(vals) : vals.length;
  if (isGrouped) {
    return rows.map((g: any) => ({ ...g, [`${field}_${operation}`]: reduce(g.items.map((i: any) => Number(_.get(i, field)) || 0)) }));
  }
  return [{ [`${field}_${operation}`]: reduce(rows.map((i) => Number(_.get(i, field)) || 0)) }];
}

// ---------------------------------------------------------------------------
// Excel + helpers
// ---------------------------------------------------------------------------

function normalizeInputOverride(raw: unknown): RowSet {
  if (raw === undefined || raw === null) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(base64, "base64"));
  if (typeof atob !== "undefined") {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  throw new FlowError("Base64 decoding not supported in this environment");
}

function parseExcelToRows(base64: string, sheetName?: string, headerRow = true): RowSet {
  const wb = XLSX.read(base64ToUint8Array(base64), { type: "array" });
  const sheet = (sheetName ? wb.Sheets[sheetName] : wb.Sheets[wb.SheetNames[0]!]) ?? wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) throw new FlowError("Excel workbook has no sheets");
  if (headerRow) return XLSX.utils.sheet_to_json(sheet, { defval: null }) as unknown[];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  if (aoa.length === 0) return [];
  const width = Math.max(...aoa.map((r) => (Array.isArray(r) ? r.length : 0)), 0);
  const cols = Array.from({ length: width }, (_, i) => XLSX.utils.encode_col(i));
  return aoa.map((row) => {
    const rec: Record<string, unknown> = {};
    cols.forEach((c, idx) => { rec[c] = Array.isArray(row) ? row[idx] : null; });
    return rec;
  });
}

function handleEmpty(onEmpty?: string): number | null {
  if (onEmpty === undefined || onEmpty === "") throw new FlowError("aggregate_groups: empty group and no 'onEmpty' set");
  if (onEmpty === "drop") return null;
  const n = Number(onEmpty);
  if (isNaN(n)) throw new FlowError(`aggregate_groups: invalid onEmpty '${onEmpty}'`);
  return n;
}

function num(v: FlowValue | undefined, node: SerializableFlowNode, slot: string): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  throw new FlowError(`${node.type}: input '${slot}' must be a number`);
}

function asArray(v: FlowValue | undefined): RowSet {
  return Array.isArray(v) ? v : [];
}

function reqRowSet(v: FlowValue | undefined, node: SerializableFlowNode, slot: string): RowSet {
  if (Array.isArray(v)) return v;
  throw new FlowError(`${node.type}: input '${slot}' must be a list (RowSet)`);
}

function reqGrouped(v: FlowValue | undefined, node: SerializableFlowNode, slot: string): Grouped {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Grouped;
  throw new FlowError(`${node.type}: input '${slot}' must be a grouped map`);
}

function reqMap(v: FlowValue | undefined, node: SerializableFlowNode, slot: string): ScalarMap {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as ScalarMap;
  throw new FlowError(`${node.type}: input '${slot}' must be a key→number map`);
}

function toInt(v: any, dflt: number): number {
  const n = parseInt(v, 10);
  return isNaN(n) ? dflt : n;
}

function round(v: number, precision: number): number {
  const f = Math.pow(10, precision);
  return Math.round(v * f) / f;
}
