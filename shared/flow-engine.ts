import _ from "lodash";
import * as XLSX from "xlsx";

/** Row/collection data flowing between nodes */
export type FlowData = unknown[];

export interface NodeData {
  label: string;
  json?: string;
  // Excel source
  excelBase64?: string;
  excelSheet?: string;
  excelHeaderRow?: boolean;
  field?: string;
  operator?: "==" | "!=" | ">" | "<" | "contains";
  value?: string | number;
  operation?: "count" | "sum" | "avg";
  // Sort node
  sortField?: string;
  sortDirection?: "asc" | "desc";
  // Limit node
  limit?: number;
  // Min/Max node
  extrema?: "min" | "max" | "both";
  result?: FlowData;
  error?: string;
}

/** Minimal node shape for execution (React Flow–compatible) */
export interface SerializableFlowNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data: NodeData;
}

export interface SerializableFlowEdge {
  source: string;
  target: string;
}

export interface ExecuteFlowOptions {
  /** When set, all `inputNode` nodes use this value instead of parsing `data.json` (API runs). */
  inputOverride?: unknown;
}

export interface ExecuteFlowResult {
  nodes: SerializableFlowNode[];
  /** Data at the last `resultNode` in execution order, or last node output if none. */
  finalOutput: unknown;
}

function normalizeInputOverride(raw: unknown): FlowData {
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) return raw as FlowData;
  return [raw];
}

function base64ToUint8Array(base64: string): Uint8Array {
  // Works in both browser (atob) and Node (Buffer).
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  if (typeof atob !== "undefined") {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  throw new Error("Base64 decoding not supported in this environment");
}

function parseExcelToRows(base64: string, sheetName?: string, headerRow = true): FlowData {
  const bytes = base64ToUint8Array(base64);
  const wb = XLSX.read(bytes, { type: "array" });
  const sheet =
    (sheetName ? wb.Sheets[sheetName] : wb.Sheets[wb.SheetNames[0]!]) ??
    wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) throw new Error("Excel workbook has no sheets");

  if (headerRow) {
    return XLSX.utils.sheet_to_json(sheet, { defval: null }) as unknown[];
  }

  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
  if (aoa.length === 0) return [];
  const width = Math.max(...aoa.map((r) => (Array.isArray(r) ? r.length : 0)), 0);
  const cols = Array.from({ length: width }, (_, i) => XLSX.utils.encode_col(i));
  return aoa.map((row) => {
    const rec: Record<string, unknown> = {};
    cols.forEach((c, idx) => {
      rec[c] = Array.isArray(row) ? row[idx] : null;
    });
    return rec;
  });
}

/**
 * Runs the flow graph and returns updated nodes (with `data.result` / `data.error`) plus final output.
 * Shared between the React client and the HTTP run API.
 */
export function executeFlow(
  nodes: SerializableFlowNode[],
  edges: SerializableFlowEdge[],
  options: ExecuteFlowOptions = {}
): ExecuteFlowResult {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n, data: { ...n.data } }]));
  const processedNodes = new Set<string>();
  const executionOrder: SerializableFlowNode[] = [];

  const incomingEdgesCount = new Map<string, number>();
  edges.forEach((e) => {
    incomingEdgesCount.set(e.target, (incomingEdgesCount.get(e.target) || 0) + 1);
  });

  const queue = nodes.filter(
    (n) => n.type === "inputNode" || (incomingEdgesCount.get(n.id) || 0) === 0
  );

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (processedNodes.has(node.id)) continue;

    processedNodes.add(node.id);
    executionOrder.push(node);

    const children = edges
      .filter((e) => e.source === node.id)
      .map((e) => nodeMap.get(e.target)!)
      .filter(Boolean);

    queue.push(...children);
  }

  const results = new Map<string, FlowData>();

  executionOrder.forEach((node) => {
    try {
      const parentEdges = edges.filter((e) => e.target === node.id);
      let inputData: FlowData = [];

      if (parentEdges.length > 0) {
        const parentId = parentEdges[0].source;
        inputData = (results.get(parentId) as FlowData) || [];
      }

      let outputData: FlowData = inputData;

      switch (node.type) {
        case "excelInputNode": {
          const base64 = node.data.excelBase64;
          if (!base64) throw new Error("Missing Excel file");
          const rows = parseExcelToRows(
            base64,
            node.data.excelSheet,
            node.data.excelHeaderRow ?? true
          );
          outputData = rows;
          break;
        }

        case "inputNode": {
          if (options.inputOverride !== undefined) {
            outputData = normalizeInputOverride(options.inputOverride);
          } else {
            const raw = node.data.json || "[]";
            try {
              const parsed = JSON.parse(raw);
              outputData = Array.isArray(parsed) ? parsed : [parsed];
            } catch {
              throw new Error("Invalid JSON input");
            }
          }
          break;
        }

        case "filterNode": {
          const { field, operator, value } = node.data;
          if (field && operator) {
            outputData = inputData.filter((item) => {
              const itemValue = _.get(item, field);
              const compareValue: string | number =
                value !== undefined && !isNaN(Number(value))
                  ? Number(value)
                  : String(value ?? "");

              switch (operator) {
                case "==":
                  return itemValue == compareValue;
                case "!=":
                  return itemValue != compareValue;
                case ">":
                  return itemValue > compareValue;
                case "<":
                  return itemValue < compareValue;
                case "contains":
                  return String(itemValue).includes(String(compareValue));
                default:
                  return true;
              }
            });
          }
          break;
        }

        case "groupNode": {
          const { field } = node.data;
          if (field) {
            outputData = Object.entries(_.groupBy(inputData, field)).map(([key, items]) => ({
              [field]: key,
              items,
              count: items.length,
            })) as FlowData;
          }
          break;
        }

        case "statsNode": {
          const { field, operation } = node.data;
          if (field && operation) {
            const isGrouped =
              inputData.length > 0 &&
              typeof inputData[0] === "object" &&
              inputData[0] !== null &&
              Array.isArray((inputData[0] as { items?: unknown }).items);

            if (isGrouped) {
              outputData = inputData.map((group: unknown) => {
                const g = group as { items: unknown[]; [k: string]: unknown };
                const values = g.items.map((i) => Number(_.get(i, field)) || 0);
                let stat = 0;
                if (operation === "sum") stat = _.sum(values);
                if (operation === "avg") stat = _.mean(values);
                if (operation === "count") stat = values.length;
                return { ...g, [`${field}_${operation}`]: stat };
              }) as FlowData;
            } else {
              const values = inputData.map((i) => Number(_.get(i, field)) || 0);
              let stat = 0;
              if (operation === "sum") stat = _.sum(values);
              if (operation === "avg") stat = _.mean(values);
              if (operation === "count") stat = values.length;
              outputData = [{ [`${field}_${operation}`]: stat }] as FlowData;
            }
          }
          break;
        }

        case "sortNode": {
          const fieldPath = node.data.sortField;
          const dir = node.data.sortDirection ?? "asc";
          if (fieldPath) {
            const factor = dir === "desc" ? -1 : 1;
            outputData = [...inputData].sort((a, b) => {
              const av = _.get(a, fieldPath);
              const bv = _.get(b, fieldPath);

              // Handle null/undefined consistently (always last)
              const aNil = av === null || av === undefined;
              const bNil = bv === null || bv === undefined;
              if (aNil && bNil) return 0;
              if (aNil) return 1;
              if (bNil) return -1;

              // Numeric compare when possible, else string compare
              const an = typeof av === "number" ? av : Number(av);
              const bn = typeof bv === "number" ? bv : Number(bv);
              const aNum = Number.isFinite(an);
              const bNum = Number.isFinite(bn);
              if (aNum && bNum) return (an - bn) * factor;

              const as = String(av);
              const bs = String(bv);
              return as.localeCompare(bs) * factor;
            }) as FlowData;
          }
          break;
        }

        case "limitNode": {
          const n = node.data.limit;
          const limit = typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
          outputData = inputData.slice(0, limit) as FlowData;
          break;
        }

        case "extremaNode": {
          const fieldPath = node.data.field;
          const mode = node.data.extrema ?? "both";
          if (fieldPath) {
            const isGrouped =
              inputData.length > 0 &&
              typeof inputData[0] === "object" &&
              inputData[0] !== null &&
              Array.isArray((inputData[0] as { items?: unknown }).items);

            const compute = (rows: unknown[]) => {
              let min = Number.POSITIVE_INFINITY;
              let max = Number.NEGATIVE_INFINITY;
              for (const r of rows) {
                const v = Number(_.get(r, fieldPath));
                if (!Number.isFinite(v)) continue;
                if (v < min) min = v;
                if (v > max) max = v;
              }
              const out: Record<string, unknown> = {};
              if (mode === "min" || mode === "both") out[`${fieldPath}_min`] = Number.isFinite(min) ? min : null;
              if (mode === "max" || mode === "both") out[`${fieldPath}_max`] = Number.isFinite(max) ? max : null;
              return out;
            };

            if (isGrouped) {
              outputData = inputData.map((group: unknown) => {
                const g = group as { items: unknown[]; [k: string]: unknown };
                return { ...g, ...compute(g.items) };
              }) as FlowData;
            } else {
              outputData = [compute(inputData)] as FlowData;
            }
          }
          break;
        }

        case "resultNode":
          break;

        default:
          break;
      }

      results.set(node.id, outputData);

      const updatedNode = nodeMap.get(node.id)!;
      updatedNode.data = {
        ...updatedNode.data,
        result: outputData,
        error: undefined,
      };
      nodeMap.set(node.id, updatedNode);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const updatedNode = nodeMap.get(node.id)!;
      updatedNode.data = {
        ...updatedNode.data,
        error: message,
        result: undefined,
      };
      nodeMap.set(node.id, updatedNode);
      results.set(node.id, []);
    }
  });

  const orderedNodes = nodes.map((n) => nodeMap.get(n.id)!);

  let finalOutput: unknown = undefined;
  for (let i = executionOrder.length - 1; i >= 0; i--) {
    const n = executionOrder[i]!;
    if (n.type === "resultNode") {
      finalOutput = results.get(n.id);
      break;
    }
  }
  if (finalOutput === undefined && executionOrder.length > 0) {
    const last = executionOrder[executionOrder.length - 1]!;
    finalOutput = results.get(last.id);
  }

  return { nodes: orderedNodes, finalOutput };
}
