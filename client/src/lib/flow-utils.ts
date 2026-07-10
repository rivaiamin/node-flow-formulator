import type { Edge, Node } from "reactflow";
import {
  executeFlow,
  type SerializableFlowNode,
  type SerializableFlowEdge,
  type FlowValue,
} from "@shared/flow-engine";

/**
 * Client-side entry point. The real engine lives in shared/flow-engine.ts
 * (used by both this editor and the HTTP run API). This wrapper adapts
 * ReactFlow's Node[] to the engine and returns nodes with results injected,
 * which the editor feeds straight back into setNodes().
 */
export function processFlow(
  nodes: Node[],
  edges: Edge[],
  datasets: Record<string, FlowValue> = {}
): Node[] {
  const { nodes: out } = executeFlow(
    nodes as unknown as SerializableFlowNode[],
    edges as unknown as SerializableFlowEdge[],
    { datasets }
  );
  return out as unknown as Node[];
}

// Re-export the shared types + port helpers so existing imports keep working.
export {
  NODE_PORTS,
  portsCompatible,
  type NodeData,
  type FlowValue,
  type RowSet,
  type Grouped,
  type ScalarMap,
  type PortType,
} from "@shared/flow-engine";
