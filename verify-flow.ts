// Headless acceptance test for the SHIPPED smak1penabur examples
// (client/src/lib/example-flows.ts) through the SHARED engine — the same code the
// client and HTTP API use — so the "Load example" menu and this proof can't drift.
// Run: pnpm test
import { executeFlow, NODE_PORTS, portsCompatible } from "./shared/flow-engine";
import { smakExamples } from "./client/src/lib/example-flows";

const eq = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b) ||
  (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9);

let pass = 0;
let fail = 0;

for (const ex of smakExamples as any[]) {
  const nodeById = Object.fromEntries(ex.nodes.map((n: any) => [n.id, n]));
  const badEdges = ex.edges.filter((e: any) => {
    const sp = NODE_PORTS[nodeById[e.source]?.type];
    const tp = NODE_PORTS[nodeById[e.target]?.type];
    const inType = tp?.in[e.targetHandle || "value"];
    return !sp || !tp || !inType || !portsCompatible(sp.out, inType);
  });

  const { nodes: out, finalOutput } = executeFlow(ex.nodes, ex.edges);
  const errs = out.filter((n: any) => n.data.error).map((n: any) => `${n.id}: ${n.data.error}`);
  const ok = badEdges.length === 0 && errs.length === 0 && eq(finalOutput, ex.expected);

  if (ok) {
    pass++;
    console.log(`  ✓ ${ex.id} -> ${JSON.stringify(finalOutput)}`);
  } else {
    fail++;
    console.log(`  ✗ ${ex.id}`);
    if (badEdges.length) console.log("      invalid edges:", badEdges.map((e: any) => e.id));
    if (errs.length) console.log("      node errors:", errs);
    if (!eq(finalOutput, ex.expected)) console.log(`      got ${JSON.stringify(finalOutput)}  want ${JSON.stringify(ex.expected)}`);
  }
}

console.log(fail === 0 ? `\nPASS ✅  ${pass}/${smakExamples.length} examples` : `\nFAIL ❌  ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
