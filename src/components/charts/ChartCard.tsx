import ReactEChartsCore from "echarts-for-react/lib/core";
import { Check, Code2, Copy, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import type { SqlValue } from "sql.js";
import { useDb } from "../../db/DbProvider";
import { runQuery } from "../../db/useQuery";
import { echarts } from "./echarts";

export interface ChartQuery {
  label?: string;
  sql: string;
}

const fmt = (v: SqlValue) => (v === null ? "–" : typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString("en-US") : String(Math.round(v * 1000) / 1000)) : String(v));

/** Runs the card's queries live (when the SQL drawer opens) and shows SQL + result. */
function SqlDrawer({ title, queries, onClose }: { title: string; queries: ChartQuery[]; onClose: () => void }) {
  const { db } = useDb();
  const [copied, setCopied] = useState<number | null>(null);
  const results = db
    ? queries.map((q) => {
        const t0 = performance.now();
        try {
          const r = runQuery<Record<string, SqlValue>>(db, q.sql);
          return { ...r, ms: performance.now() - t0, error: null as string | null };
        } catch (e) {
          return { rows: [], columns: [], ms: 0, error: e instanceof Error ? e.message : "Query failed" };
        }
      })
    : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={`SQL for ${title}`}
        initial={{ x: 40 }}
        animate={{ x: 0 }}
        exit={{ x: 40 }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
        className="relative flex h-full w-full max-w-[560px] flex-col border-l border-line bg-panel shadow-pop"
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Query behind</p>
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <button autoFocus onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink" aria-label="Close SQL">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>
        <div className="scroll-thin min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {queries.map((q, i) => {
            const r = results[i];
            return (
              <section key={i}>
                {q.label && <p className="mb-2 text-xs font-medium text-ink-2">{q.label}</p>}
                <div className="relative rounded-lg border border-line bg-canvas">
                  <pre className="scroll-thin overflow-x-auto p-3 pr-10 font-mono text-[12px] leading-relaxed text-ink-2">{q.sql.trim()}</pre>
                  <button
                    onClick={() =>
                      navigator.clipboard?.writeText(q.sql.trim()).then(
                        () => {
                          setCopied(i);
                          setTimeout(() => setCopied(null), 1400);
                        },
                        () => {},
                      )
                    }
                    className="absolute right-2 top-2 rounded-md border border-line bg-raised p-1.5 text-muted hover:text-ink"
                    aria-label="Copy SQL"
                  >
                    {copied === i ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {r?.error ? (
                  <p className="mt-2 text-sm text-late">{r.error}</p>
                ) : r ? (
                  <>
                    <p className="mt-2 text-[11px] text-muted">
                      Ran in your browser: {r.rows.length} row{r.rows.length === 1 ? "" : "s"} in {r.ms.toFixed(1)} ms
                    </p>
                    <div className="scroll-thin mt-2 max-h-72 overflow-auto rounded-lg border border-line">
                      <table className="w-full text-left text-[12px]">
                        <thead className="sticky top-0 bg-raised text-muted">
                          <tr>
                            {r.columns.map((c) => (
                              <th key={c} scope="col" className="whitespace-nowrap px-3 py-1.5 font-medium">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {r.rows.slice(0, 300).map((row, j) => (
                            <tr key={j} className="border-t border-line">
                              {r.columns.map((c) => (
                                <td key={c} className="num whitespace-nowrap px-3 py-1 text-ink-2">
                                  {fmt(row[c])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </section>
            );
          })}
        </div>
      </motion.aside>
    </motion.div>
  );
}

/**
 * A chart with a Chart/Table toggle and a "Show SQL" drawer.
 * `table` is what the table view shows (header + rows, already formatted).
 */
export function ChartCard({
  title,
  subtitle,
  option,
  height = 280,
  table,
  queries,
  source,
  footer,
  className = "",
}: {
  title: string;
  subtitle?: string;
  option: object | null;
  height?: number;
  table: { head: string[]; rows: (string | number)[][] };
  queries?: ChartQuery[];
  /** Shown instead of "Show SQL" when the numbers come from a file. */
  source?: string;
  footer?: ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [sql, setSql] = useState(false);
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <section aria-labelledby={id} className={`panel flex min-w-0 flex-col ${className}`}>
      <header className="flex flex-col gap-2 px-5 pt-4 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label={`${title} view`} className="flex rounded-md border border-line p-0.5 text-xs">
            {(["chart", "table"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded px-2 py-1 capitalize ${view === v ? "bg-raised text-ink" : "text-muted hover:text-ink"}`}
              >
                {v}
              </button>
            ))}
          </div>
          {queries && (
            <button onClick={() => setSql(true)} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-2 hover:border-line-strong hover:text-ink">
              <Code2 aria-hidden="true" className="h-3.5 w-3.5" />
              Show SQL
            </button>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 px-3 pb-3 pt-2">
        {view === "chart" ? (
          option ? (
            <ReactEChartsCore echarts={echarts} option={option} style={{ height, width: "100%" }} notMerge />
          ) : (
            <div className="shimmer m-2 rounded-lg" style={{ height: height - 16 }} />
          )
        ) : (
          <div className="scroll-thin overflow-auto rounded-lg border border-line" style={{ maxHeight: height }}>
            <table className="w-full text-left text-[13px]">
              <caption className="sr-only">{title}</caption>
              <thead className="sticky top-0 bg-raised text-xs text-muted">
                <tr>
                  {table.head.map((h) => (
                    <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {r.map((v, j) => (
                      <td key={j} className={`whitespace-nowrap px-3 py-1.5 ${j === 0 ? "text-ink" : "num text-ink-2"}`}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {(footer || source) && (
        <footer className="border-t border-line px-5 py-3 text-xs text-muted">
          {footer}
          {source && <span>Source: {source}</span>}
        </footer>
      )}
      <AnimatePresence>{sql && queries && <SqlDrawer title={title} queries={queries} onClose={() => setSql(false)} />}</AnimatePresence>
    </section>
  );
}
