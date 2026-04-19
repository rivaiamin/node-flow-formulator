import _ from "lodash";

/** Row/collection data flowing between nodes */
export type FlowData = unknown[];

export interface NodeData {
  label: string;
  json?: string;
  field?: string;
  operator?: "==" | "!=" | ">" | "<" | "contains";
  value?: string | number;
  operation?: "count" | "sum" | "avg";
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
