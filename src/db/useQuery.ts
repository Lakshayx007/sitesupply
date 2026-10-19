import { useMemo } from "react";
import type { Database, SqlValue } from "sql.js";
import { useDb } from "./DbProvider";

export type Row = Record<string, SqlValue>;

export interface QueryResult<T = Row> {
  /** Rows as objects keyed by column name. */
  rows: T[];
  /** Column names in SELECT order (handy for the "Show SQL" result table). */
  columns: string[];
  /** True until the database has been opened. */
  loading: boolean;
  error: Error | null;
}

/** Runs one SQL statement and returns rows as objects. Throws on SQL errors. */
export function runQuery<T = Row>(
  db: Database,
  sql: string,
  params?: Record<string, SqlValue> | SqlValue[],
): { rows: T[]; columns: string[] } {
  const stmt = db.prepare(sql);
  try {
    if (params) stmt.bind(params);
    const columns = stmt.getColumnNames();
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return { rows, columns };
  } finally {
    stmt.free();
  }
}

/**
 * Runs a SQL query against the in-browser sample database.
 * The result is memoised on the SQL text and parameters, so re-renders are free.
 *
 *   const { rows, loading, error } = useQuery<{ otif: number }>("SELECT AVG(otif) AS otif FROM orders WHERE cancelled = 0");
 */
export function useQuery<T = Row>(
  sql: string,
  params?: Record<string, SqlValue> | SqlValue[],
): QueryResult<T> {
  const { status, db, error } = useDb();
  const key = params ? JSON.stringify(params) : "";

  return useMemo<QueryResult<T>>(() => {
    if (status === "loading") return { rows: [], columns: [], loading: true, error: null };
    if (status === "error") return { rows: [], columns: [], loading: false, error };
    try {
      const { rows, columns } = runQuery<T>(db, sql, params);
      return { rows, columns, loading: false, error: null };
    } catch (e) {
      return { rows: [], columns: [], loading: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, db, error, sql, key]);
}
