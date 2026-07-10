import type { Response } from "express";
import type { Flow } from "@shared/schema";
import { executeFlow, type ExecuteFlowOptions } from "@shared/flow-engine";
import type { SerializableFlowEdge, SerializableFlowNode } from "@shared/flow-engine";

export interface SendFlowRunOptions {
  /** Include `flowId` in JSON (used by `POST /api/flows/run`). */
  includeFlowId?: boolean;
}

export function sendFlowRunResult(
  res: Response,
  flow: Flow,
  inputOverride: unknown | undefined,
  sendOptions?: SendFlowRunOptions
): void {
  const raw = flow.flowData as {
    nodes?: SerializableFlowNode[];
    edges?: SerializableFlowEdge[];
  };
  const nodes = raw?.nodes;
  const edges = raw?.edges;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    const body: Record<string, unknown> = {
      message: "Flow data is missing nodes or edges",
    };
    if (sendOptions?.includeFlowId) body.flowId = flow.id;
    res.status(422).json(body);
    return;
  }

  const options: ExecuteFlowOptions = {};
  if (inputOverride !== undefined) {
    options.inputOverride = inputOverride;
  }

  const { nodes: executed, finalOutput } = executeFlow(nodes, edges, options);

  const nodeErrors: Record<string, string> = {};
  for (const n of executed) {
    if (n.data?.error) {
      nodeErrors[n.id] = n.data.error;
    }
  }

  const hasError = Object.keys(nodeErrors).length > 0;
  if (hasError) {
    const body: Record<string, unknown> = {
      message: "Flow execution completed with errors",
      output: finalOutput,
      nodeErrors,
    };
    if (sendOptions?.includeFlowId) body.flowId = flow.id;
    res.status(422).json(body);
    return;
  }

  const body: Record<string, unknown> = {
    output: finalOutput,
    nodeErrors: undefined,
  };
  if (sendOptions?.includeFlowId) body.flowId = flow.id;
  res.json(body);
}
