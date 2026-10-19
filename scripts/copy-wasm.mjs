// Copies the sql.js WebAssembly binary into public/ so the browser can load it.
// Runs automatically after `npm install` (postinstall).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
const dest = join(root, "public", "sql-wasm.wasm");

if (!existsSync(src)) {
  console.warn("[copy-wasm] sql.js not installed yet; skipping.");
} else {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log("[copy-wasm] public/sql-wasm.wasm updated");
}
