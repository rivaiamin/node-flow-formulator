// Headless acceptance test for the kog_score flow.
// Tests the SHIPPED example (client/src/lib/example-flows.ts) through the SHARED
// engine (shared/flow-engine.ts) — the same code the client and HTTP API use —
// so the "Load example" button, the API, and this proof can't drift apart.
// Run: pnpm test   → expect kog_score = 79.06
// Contract: docs/calculation-graph-editor-contract.md §2c (AIMSIS repo)
import { executeFlow, NODE_PORTS, portsCompatible } from "./shared/flow-engine";
import { kogScoreExample } from "./client/src/lib/example-flows";

const { nodes, edges } = kogScoreExample as any;

// 1) every edge in the example must be legal under the port types
const nodeById = Object.fromEntries(nodes.map((n: any) => [n.id, n]));
const badEdges = edges.filter((e: any) => {
  const sp = NODE_PORTS[nodeById[e.source]?.type];
  const tp = NODE_PORTS[nodeById[e.target]?.type];
  const inType = tp?.in[e.targetHandle || "value"];
  return !sp || !tp || !inType || !portsCompatible(sp.out, inType);
});

// 2) the flow must evaluate to 79.06
const { nodes: out, finalOutput } = executeFlow(nodes, edges);
const byId = Object.fromEntries(out.map((n: any) => [n.id, n.data]));
const errs = out.filter((n: any) => n.data.error).map((n: any) => `${n.id}: ${n.data.error}`);

console.log("Level A (n3):", JSON.stringify(byId.n3.result));
console.log("Level B (n5):", byId.n5.result);
console.log("finalOutput (kog_score):", finalOutput);
if (badEdges.length) console.log("INVALID EDGES:", badEdges.map((e: any) => e.id));
if (errs.length) console.log("ERRORS:", errs);

const ok = finalOutput === 79.06 && errs.length === 0 && badEdges.length === 0;
console.log(ok ? "\nPASS ✅  kog_score = 79.06, all edges type-valid" : "\nFAIL ❌");
process.exit(ok ? 0 : 1);
