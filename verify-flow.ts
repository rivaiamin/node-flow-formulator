// Headless acceptance test for the kog_score flow.
// Tests the SHIPPED example (client/src/lib/example-flows.ts) so the "Load example"
// button and this proof can never drift apart.
// Run: pnpm exec tsx verify-flow.ts   → expect kog_score = 79.06
// Contract: docs/calculation-graph-editor-contract.md §2c (AIMSIS repo)
import { processFlow, NODE_PORTS, portsCompatible } from "./client/src/lib/flow-utils";
import { kogScoreExample } from "./client/src/lib/example-flows";

const { nodes, edges } = kogScoreExample;

// 1) every edge in the example must be a legal connection under the port types
const nodeById = Object.fromEntries(nodes.map((n: any) => [n.id, n]));
const badEdges = edges.filter((e: any) => {
  const sp = NODE_PORTS[nodeById[e.source]?.type];
  const tp = NODE_PORTS[nodeById[e.target]?.type];
  const inType = tp?.in[e.targetHandle || "value"];
  return !sp || !tp || !inType || !portsCompatible(sp.out, inType);
});

// 2) the flow must evaluate to 79.06
const out = processFlow(nodes as any, edges as any);
const byId = Object.fromEntries(out.map((n: any) => [n.id, n.data]));
const errs = out.filter((n: any) => n.data.error).map((n: any) => `${n.id}: ${n.data.error}`);

console.log("Level A (n3):", JSON.stringify(byId.n3.result));
console.log("Level B (n5):", byId.n5.result);
console.log("kog_score (n7):", byId.n7.result);
if (badEdges.length) console.log("INVALID EDGES:", badEdges.map((e: any) => e.id));
if (errs.length) console.log("ERRORS:", errs);

const ok = byId.n7.result === 79.06 && errs.length === 0 && badEdges.length === 0;
console.log(ok ? "\nPASS ✅  kog_score = 79.06, all edges type-valid" : "\nFAIL ❌");
process.exit(ok ? 0 : 1);
