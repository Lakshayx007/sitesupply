// Copies the sql.js WebAssembly binary into public/ so the browser can load it.
// Runs automatically after `npm install` (postinstall).
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
const dest = join(root, "public", "sql-wasm.wasm");

if (!existsSync(src)) {
  console.warn("[copy-wasm] sql.js not installed yet; skipping.");
} else {
  mkdirSync(dirname(dest), { recursive: true });
  // Leave the committed file alone when it is already the same, so installing never shows up as a change in git.
  if (existsSync(dest) && readFileSync(dest).equals(readFileSync(src))) {
    console.log("[copy-wasm] public/sql-wasm.wasm is up to date");
  } else {
    copyFileSync(src, dest);
    chmodSync(dest, 0o644); // the npm package ships it as executable; git tracks it as a normal file
    console.log("[copy-wasm] public/sql-wasm.wasm updated");
  }
}
