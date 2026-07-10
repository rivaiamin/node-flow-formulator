import type { Edge, Node } from "reactflow";
import _ from "lodash";

/**
 * Flow execution engine (browser-side preview evaluator).
 *
 * Mirrors the AIMSIS PHP GraphEvaluatorService on the same canonical graph.
 * See docs/calculation-graph-editor-contract.md + calculation-graph-node-model.md.
 *
 * Value types a wire can carry:
 *   Scalar     number (final scores, weights)
 *   RowSet     any[]  (rows from a source / filter)
 *   Grouped    { key -> RowSet }   (output of group_by)
 *   ScalarMap  { key -> number }   (output of aggregate_groups / a source that is an object)
 *
 * Fail-loud: a node that can't produce a value stores an error and produces
 * nothing, so downstream nodes fail on the missing input rather than fabricating
 * a number. Execution order is a proper topological sort (Kahn), so a node with
 * two parents (e.g. combine_by_key) only runs after BOTH parents.
 */

export type RowSet = any[];
export type Grouped = Record<string, any[]>;
export type ScalarMap = Record<string, number>;
export type FlowValue = number | string | RowSet | Grouped | ScalarMap;

export interface NodeData {
  label: string;
  // source
  dataset?: string;
  json?: string;
  // filter (field/operator/value)
  field?: string;
  operator?: "==" | "!=" | ">" | "<" | "contains";
  value?: string | number; // filter: compare value · aggregate_groups: value-field name
  // aggregate_groups / combine_by_key
  op?: "weighted_average" | "weighted_sum" | "sum" | "average" | "count" | "min" | "max";
  weight?: string; // aggregate_groups: weight-field name
  onEmpty?: string; // "drop" | numeric string
  // round
  precision?: number | string;
  // output
  name?: string;
  // execution result (injected during run)
  result?: FlowValue;
  error?: string;
}

class FlowError extends Error {}

export const processFlow = (
  nodes: Node<NodeData>[],
  edges: Edge[],
  datasets: Record<string, FlowValue> = {}
): Node<NodeData>[] => {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));

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

  // Gather a node's inputs keyed by the edge's targetHandle (the slot name).
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

  order.forEach((nodeId) => {
    const node = nodeMap.get(nodeId)!;
    try {
      const inp = inputsOf(nodeId);
      let out: FlowValue;

      switch (node.type) {
        case "source":
          out = execSource(node.data, datasets);
          break;
        case "filter":
          out = execFilter(node.data, reqRowSet(inp.rows, node, "rows"));
          break;
        case "group_by":
          out = execGroupBy(node.data, reqRowSet(inp.rows, node, "rows"));
          break;
        case "aggregate_groups":
          out = execAggregateGroups(node.data, reqGrouped(inp.groups, node, "groups"));
          break;
        case "combine_by_key":
          out = execCombineByKey(
            node.data,
            reqMap(inp.values, node, "values"),
            reqMap(inp.weights, node, "weights")
          );
          break;
        case "round":
          out = round(num(inp.value, node, "value"), toInt(node.data.precision, 0));
          break;
        case "output":
          if (inp.value === undefined) throw new FlowError("output: missing input 'value'");
          out = inp.value;
          break;
        default:
          throw new FlowError(`Unknown node type '${node.type}'`);
      }

      results.set(nodeId, out);
      nodeMap.set(nodeId, { ...node, data: { ...node.data, result: out, error: undefined } });
    } catch (err: any) {
      nodeMap.set(nodeId, { ...node, data: { ...node.data, error: err.message, result: undefined } });
      // Intentionally do NOT set results.get(nodeId): downstream fails loud.
    }
  });

  return Array.from(nodeMap.values());
};

// ---------------------------------------------------------------------------
// Node implementations
// ---------------------------------------------------------------------------

function execSource(data: NodeData, datasets: Record<string, FlowValue>): FlowValue {
  // A bound dataset (provided at run time) wins; else parse the sample JSON.
  if (data.dataset && Object.prototype.hasOwnProperty.call(datasets, data.dataset)) {
    return datasets[data.dataset];
  }
  const raw = (data.json ?? "").trim();
  if (!raw) {
    throw new FlowError(
      `source: no dataset '${data.dataset ?? ""}' provided and no sample JSON`
    );
  }
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new FlowError("source: invalid JSON");
  }
  return parsed; // RowSet (array) or ScalarMap (object)
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

    if (op === "count") {
      out[key] = rows.length;
      continue;
    }

    if (rows.length === 0) {
      const e = handleEmpty(data.onEmpty);
      if (e !== null) out[key] = e;
      continue;
    }

    if (!valueField) throw new FlowError("aggregate_groups: 'value' (field name) is required");
    const values = rows.map((r) => Number(_.get(r, valueField)) || 0);
    const weights = weightField
      ? rows.map((r) => Number(_.get(r, weightField)) || 0)
      : rows.map(() => 1);

    let res: number | null;
    switch (op) {
      case "sum": res = _.sum(values); break;
      case "average": res = _.mean(values); break;
      case "min": res = Math.min(...values); break;
      case "max": res = Math.max(...values); break;
      case "weighted_sum":
        res = values.reduce((a, v, i) => a + v * weights[i], 0);
        break;
      case "weighted_average": {
        const sw = _.sum(weights);
        res = sw === 0 ? handleEmpty(data.onEmpty) : values.reduce((a, v, i) => a + v * weights[i], 0) / sw;
        break;
      }
      default:
        throw new FlowError(`aggregate_groups: unknown op '${op}'`);
    }

    if (res !== null) out[key] = res;
  }

  return out;
}

function handleEmpty(onEmpty?: string): number | null {
  if (onEmpty === undefined || onEmpty === "") {
    throw new FlowError("aggregate_groups: empty group and no 'onEmpty' set");
  }
  if (onEmpty === "drop") return null;
  const n = Number(onEmpty);
  if (isNaN(n)) throw new FlowError(`aggregate_groups: invalid onEmpty '${onEmpty}'`);
  return n;
}

function execCombineByKey(data: NodeData, values: ScalarMap, weights: ScalarMap): number {
  const op = (data.op as string) || "weighted_average";
  const keys = Object.keys(values).filter((k) =>
    Object.prototype.hasOwnProperty.call(weights, k)
  );
  if (keys.length === 0) {
    throw new FlowError("combine_by_key: no shared keys between values and weights");
  }
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

// ---------------------------------------------------------------------------
// Type guards / helpers
// ---------------------------------------------------------------------------

function num(v: FlowValue | undefined, node: Node<NodeData>, slot: string): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  throw new FlowError(`${node.type}: input '${slot}' must be a number`);
}

function reqRowSet(v: FlowValue | undefined, node: Node<NodeData>, slot: string): RowSet {
  if (Array.isArray(v)) return v;
  throw new FlowError(`${node.type}: input '${slot}' must be a list (RowSet)`);
}

function reqGrouped(v: FlowValue | undefined, node: Node<NodeData>, slot: string): Grouped {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Grouped;
  throw new FlowError(`${node.type}: input '${slot}' must be a grouped map`);
}

function reqMap(v: FlowValue | undefined, node: Node<NodeData>, slot: string): ScalarMap {
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

// ---------------------------------------------------------------------------
// Port types — used by the editor to reject invalid wiring before you run.
// (node-model doc, DECISION A: validate connections, don't discover at runtime)
// ---------------------------------------------------------------------------

export type PortType = "rowset" | "grouped" | "scalarmap" | "scalar" | "any";

export const NODE_PORTS: Record<string, { out: PortType; in: Record<string, PortType> }> = {
  // `source` is "any": it yields a RowSet or a ScalarMap depending on its JSON.
  source:           { out: "any",       in: {} },
  filter:           { out: "rowset",    in: { rows: "rowset" } },
  group_by:         { out: "grouped",   in: { rows: "rowset" } },
  aggregate_groups: { out: "scalarmap", in: { groups: "grouped" } },
  combine_by_key:   { out: "scalar",    in: { values: "scalarmap", weights: "scalarmap" } },
  round:            { out: "scalar",    in: { value: "scalar" } },
  output:           { out: "any",       in: { value: "any" } },
};

export const portsCompatible = (a: PortType, b: PortType): boolean =>
  a === "any" || b === "any" || a === b;
