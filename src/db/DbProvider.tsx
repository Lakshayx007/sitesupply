import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import initSqlJs, { type Database } from "sql.js";

/**
 * Opens public/data/sitesupply.sqlite once at start-up with sql.js and shares it
 * through React context. Everything runs in the browser: there is no backend.
 */

export type DbState =
  | { status: "loading"; db: null; error: null }
  | { status: "ready"; db: Database; error: null }
  | { status: "error"; db: null; error: Error };

const DbContext = createContext<DbState>({ status: "loading", db: null, error: null });

// Resolve against the page so it works on any static host / sub-path (vite base is "./").
const asset = (path: string) => new URL(path, document.baseURI).toString();

let dbPromise: Promise<Database> | null = null;

/** Loads the database once per page load; later calls reuse the same promise. */
export function loadDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const [SQL, buf] = await Promise.all([
        initSqlJs({ locateFile: (file) => asset(file) }),
        fetch(asset("data/sitesupply.sqlite")).then((r) => {
          if (!r.ok) throw new Error(`Could not load the sample database (HTTP ${r.status}).`);
          return r.arrayBuffer();
        }),
      ]);
      return new SQL.Database(new Uint8Array(buf));
    })();
    dbPromise.catch(() => {
      dbPromise = null; // allow a retry after a failure
    });
  }
  return dbPromise;
}

export function DbProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DbState>({ status: "loading", db: null, error: null });

  useEffect(() => {
    let alive = true;
    loadDatabase()
      .then((db) => alive && setState({ status: "ready", db, error: null }))
      .catch((e: unknown) =>
        alive && setState({ status: "error", db: null, error: e instanceof Error ? e : new Error(String(e)) }),
      );
    return () => {
      alive = false;
    };
  }, []);

  return <DbContext.Provider value={state}>{children}</DbContext.Provider>;
}

export function useDb(): DbState {
  return useContext(DbContext);
}
