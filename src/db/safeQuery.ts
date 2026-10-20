import type { Database, SqlValue } from "sql.js";
import { dbSource } from "./DbProvider";

/**
 * Runs a read-only query for "Ask SiteSupply" in a background worker with a time and row limit.
 * A query that takes too long (an endless recursive CTE, a huge cross join) is stopped by
 * terminating the worker, so the tab never freezes. Falls back to the main thread (row limit only)
 * where workers are not available.
 */

export const QUERY_LIMITS = { timeoutMs: 5000, maxRows: 200 };

export class QueryTimeout extends Error {
  constructor() {
    super("That query was taking too long, so it was stopped. Try a narrower question.");
  }
}

type Result = { columns: string[]; rows: SqlValue[][] };
type Pending = { resolve: (r: Result) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let workerReady: Promise<Worker | null> | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function startWorker(): Promise<Worker | null> {
  if (workerReady) return workerReady;
  const src = dbSource();
  if (!src || typeof Worker === "undefined") return Promise.resolve(null);
  workerReady = new Promise<Worker | null>((resolve) => {
    let w: Worker;
    try {
      w = new Worker(new URL("./askWorker.ts", import.meta.url), { type: "module" });
    } catch {
      resolve(null);
      return;
    }
    const fail = () => {
      w.terminate();
      resolve(null);
    };
    const timer = window.setTimeout(fail, 15000);
    w.onerror = () => {
      window.clearTimeout(timer);
      fail();
    };
    w.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; id?: number; columns?: string[]; rows?: SqlValue[][]; error?: string };
      if (m.type === "ready") {
        window.clearTimeout(timer);
        worker = w;
        resolve(w);
      } else if (m.type === "init-error") {
        window.clearTimeout(timer);
        fail();
      } else if (m.type === "result" && m.id !== undefined) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (!p) return;
        if (m.error) p.reject(new Error(m.error));
        else p.resolve({ columns: m.columns ?? [], rows: m.rows ?? [] });
      }
    };
    w.postMessage({ type: "init", bytes: src.bytes, wasmUrl: src.wasmUrl }); // copied, not transferred
  });
  workerReady.then((w) => {
    if (!w) workerReady = null; // allow a later retry
  });
  return workerReady;
}

function stopWorker() {
  worker?.terminate();
  worker = null;
  workerReady = null;
  for (const p of pending.values()) p.reject(new QueryTimeout());
  pending.clear();
}

function onMainThread(db: Database, sql: string, maxRows: number): Result {
  const stmt = db.prepare(sql);
  try {
    const columns = stmt.getColumnNames();
    const rows: SqlValue[][] = [];
    while (rows.length < maxRows && stmt.step()) rows.push(stmt.get());
    return { columns, rows };
  } finally {
    stmt.free();
  }
}

export async function runSafeQuery(db: Database, sql: string, limits = QUERY_LIMITS): Promise<Result> {
  const w = await startWorker();
  if (!w) return onMainThread(db, sql, limits.maxRows);
  const id = ++nextId;
  return new Promise<Result>((resolve, reject) => {
    const timer = window.setTimeout(stopWorker, limits.timeoutMs);
    pending.set(id, {
      resolve: (r) => {
        window.clearTimeout(timer);
        resolve(r);
      },
      reject: (e) => {
        window.clearTimeout(timer);
        reject(e);
      },
    });
    w.postMessage({ type: "run", id, sql, maxRows: limits.maxRows });
  });
}
