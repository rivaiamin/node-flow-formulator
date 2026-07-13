import type { Response } from "express";
import type { Flow } from "@shared/schema";
import {
  executeFlow,
  type ExecuteFlowOptions,
  type FlowValue,
  type SerializableFlowEdge,
  type SerializableFlowNode,
} from "@shared/flow-engine";

export interface SendFlowRunOptions {
  /** Include `flowId` in JSON (used by `POST /api/flows/run`). */
  includeFlowId?: boolean;
}

export interface FlowRunBody {
  /** Legacy single-source override for Input / unbound Source nodes. */
  input?: unknown;
  /** Named datasets for collection-model `source` nodes (`data.dataset` keys). */
  datasets?: Record<string, unknown>;
}

export function sendFlowRunResult(
  res: Response,
  flow: Flow,
  body: FlowRunBody,
  sendOptions?: SendFlowRunOptions
): void {
  const raw = flow.flowData as {
    nodes?: SerializableFlowNode[];
    edges?: SerializableFlowEdge[];
  };
  const nodes = raw?.nodes;
  const edges = raw?.edges;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    const out: Record<string, unknown> = {
      message: "Flow data is missing nodes or edges",
    };
    if (sendOptions?.includeFlowId) out.flowId = flow.id;
    res.status(422).json(out);
    return;
  }

  const options: ExecuteFlowOptions = {};
  if (body.input !== undefined) {
    options.inputOverride = body.input;
  }
  if (body.datasets !== undefined) {
    options.datasets = body.datasets as Record<string, FlowValue>;
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
    const out: Record<string, unknown> = {
      message: "Flow execution completed with errors",
      output: finalOutput,
      nodeErrors,
    };
    if (sendOptions?.includeFlowId) out.flowId = flow.id;
    res.status(422).json(out);
    return;
  }

  const out: Record<string, unknown> = {
    output: finalOutput,
    nodeErrors: undefined,
  };
  if (sendOptions?.includeFlowId) out.flowId = flow.id;
  res.json(out);
}
