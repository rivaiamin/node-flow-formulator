import { Edge, Node } from "reactflow";
import _ from "lodash";

export type FlowData = any[];

export interface NodeData {
  label: string;
  // Input Node
  json?: string;
  // Filter Node
  field?: string;
  operator?: "==" | "!=" | ">" | "<" | "contains";
  value?: string | number;
  // Group/Stats Node
  operation?: "count" | "sum" | "avg";
  // Execution Result (injected during run)
  result?: FlowData;
  error?: string;
}

export const processFlow = (nodes: Node<NodeData>[], edges: Edge[]) => {
  // Create a map of nodes for easy access
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
  const processedNodes = new Set<string>();
  const executionOrder: Node<NodeData>[] = [];

  // Find root nodes (no incoming edges or Input type)
  const incomingEdgesCount = new Map<string, number>();
  edges.forEach((e) => {
    incomingEdgesCount.set(e.target, (incomingEdgesCount.get(e.target) || 0) + 1);
  });

  const queue = nodes.filter(
    (n) => n.type === "inputNode" || (incomingEdgesCount.get(n.id) || 0) === 0
  );

  // Topological sort / BFS for execution order
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (processedNodes.has(node.id)) continue;

    processedNodes.add(node.id);
    executionOrder.push(node);

    // Find children
    const children = edges
      .filter((e) => e.source === node.id)
      .map((e) => nodeMap.get(e.target)!);

    queue.push(...children);
  }

  // Execute logic
  const results = new Map<string, any>(); // Node ID -> Result Data

  executionOrder.forEach((node) => {
    try {
      // 1. Get Input Data from Parent(s)
      const parentEdges = edges.filter((e) => e.target === node.id);
      let inputData: any[] = [];
      
      if (parentEdges.length > 0) {
        // For simplicity, take data from the first parent, or merge if needed.
        // In this MVP, we just take the first connection.
        const parentId = parentEdges[0].source;
        inputData = results.get(parentId) || [];
      }

      // 2. Process Node Logic
      let outputData = inputData;

      switch (node.type) {
        case "inputNode": {
          const raw = node.data.json || "[]";
          try {
            outputData = JSON.parse(raw);
            if (!Array.isArray(outputData)) outputData = [outputData];
          } catch (e) {
            throw new Error("Invalid JSON input");
          }
          break;
        }

        case "filterNode": {
          const { field, operator, value } = node.data;
          if (field && operator) {
            outputData = inputData.filter((item) => {
              const itemValue = _.get(item, field);
              const compareValue = !isNaN(Number(value)) ? Number(value) : value;
              
              switch (operator) {
                case "==": return itemValue == compareValue;
                case "!=": return itemValue != compareValue;
                case ">": return itemValue > compareValue;
                case "<": return itemValue < compareValue;
                case "contains": return String(itemValue).includes(String(compareValue));
                default: return true;
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
              count: items.length
            }));
          }
          break;
        }

        case "statsNode": {
          const { field, operation } = node.data;
          if (field && operation) {
            // Check if input is grouped (has 'items' array) or flat
            const isGrouped = inputData.length > 0 && Array.isArray(inputData[0].items);
            
            if (isGrouped) {
              outputData = inputData.map((group: any) => {
                const values = group.items.map((i: any) => Number(_.get(i, field)) || 0);
                let stat = 0;
                if (operation === "sum") stat = _.sum(values);
                if (operation === "avg") stat = _.mean(values);
                if (operation === "count") stat = values.length;
                return { ...group, [`${field}_${operation}`]: stat };
              });
            } else {
              const values = inputData.map((i) => Number(_.get(i, field)) || 0);
              let stat = 0;
              if (operation === "sum") stat = _.sum(values);
              if (operation === "avg") stat = _.mean(values);
              if (operation === "count") stat = values.length;
              outputData = [{ [`${field}_${operation}`]: stat }];
            }
          }
          break;
        }

        case "resultNode": {
          // Pass through, but we will store this final result
          break;
        }
      }

      results.set(node.id, outputData);
      
      // Update the actual node object in our map to reflect the result for display
      const updatedNode = nodeMap.get(node.id)!;
      updatedNode.data = { ...updatedNode.data, result: outputData, error: undefined };
      nodeMap.set(node.id, updatedNode);

    } catch (err: any) {
      const updatedNode = nodeMap.get(node.id)!;
      updatedNode.data = { ...updatedNode.data, error: err.message, result: undefined };
      nodeMap.set(node.id, updatedNode);
      results.set(node.id, []); // Pass empty downstream on error
    }
  });

  return Array.from(nodeMap.values());
};
