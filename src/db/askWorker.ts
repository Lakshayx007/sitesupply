/// <reference lib="webworker" />
// Runs "Ask SiteSupply" queries off the main thread, so a slow or endless query can be stopped
// (the page terminates this worker) without freezing the visitor's tab.
import initSqlJs, { type Database } from "sql.js";

type In =
  | { type: "init"; bytes: Uint8Array; wasmUrl: string }
  | { type: "run"; id: number; sql: string; maxRows: number };

let ready: Promise<Database> | null = null;

self.onmessage = async (e: MessageEvent<In>) => {
  const msg = e.data;
  if (msg.type === "init") {
    ready = initSqlJs({ locateFile: () => msg.wasmUrl }).then((SQL) => {
      const db = new SQL.Database(msg.bytes);
      db.run("PRAGMA query_only = 1"); // belt and braces: this copy can never be changed
      return db;
    });
    ready.then(
      () => self.postMessage({ type: "ready" }),
      (err) => self.postMessage({ type: "init-error", error: String(err?.message ?? err) }),
    );
    return;
  }
  if (msg.type === "run") {
    try {
      const db = await ready!;
      const stmt = db.prepare(msg.sql);
      try {
        const columns = stmt.getColumnNames();
        const rows: unknown[][] = [];
        while (rows.length < msg.maxRows && stmt.step()) rows.push(stmt.get());
        self.postMessage({ type: "result", id: msg.id, columns, rows });
      } finally {
        stmt.free();
      }
    } catch (err) {
      self.postMessage({ type: "result", id: msg.id, error: String((err as Error)?.message ?? err) });
    }
  }
};
