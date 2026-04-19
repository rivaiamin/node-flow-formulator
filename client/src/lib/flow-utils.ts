import type { Edge, Node } from "reactflow";
import {
  executeFlow,
  type ExecuteFlowOptions,
  type NodeData,
} from "@shared/flow-engine";

export type { FlowData, NodeData } from "@shared/flow-engine";

/** Runs the flow and returns React Flow nodes with updated `data.result` / `data.error`. */
export function processFlow(
  nodes: Node<NodeData>[],
  edges: Edge[],
  options?: ExecuteFlowOptions
): Node<NodeData>[] {
  const { nodes: executed } = executeFlow(
    nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
    edges.map((e) => ({ source: e.source, target: e.target })),
    options
  );

  const byId = new Map(executed.map((n) => [n.id, n]));
  return nodes.map((n) => {
    const u = byId.get(n.id);
    if (!u) return n;
    return { ...n, data: u.data };
  });
}
