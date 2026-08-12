import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(root, "client/src/index.css"), "utf8");

const darkBlock = css.match(/\.dark\s*\{([\s\S]*?)\}/);
if (!darkBlock) {
  console.error("FAIL: missing .dark { ... } block");
  process.exit(1);
}
if (!darkBlock[1].includes("--background: 222 47% 11%")) {
  console.error("FAIL: .dark must keep --background: 222 47% 11%");
  process.exit(1);
}

const rootBlock = css.match(/:root\s*\{([\s\S]*?)\}/);
if (!rootBlock) {
  console.error("FAIL: missing :root { ... } block");
  process.exit(1);
}
if (rootBlock[1].includes("--background: 222 47% 11%")) {
  console.error("FAIL: :root still has dark background; expected light tokens");
  process.exit(1);
}
if (!rootBlock[1].includes("--background: 0 0% 100%")) {
  console.error("FAIL: :root missing light --background: 0 0% 100%");
  process.exit(1);
}

console.log("OK: theme CSS light :root + dark .dark");
