import { ArrowUp, Check, ChevronDown, Code2, Copy, Sparkles, Square, Table2, TriangleAlert } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { SqlValue } from "sql.js";
import { useDb } from "../../db/DbProvider";
import { runQuery } from "../../db/useQuery";
import { AiError } from "../../lib/ai";
import { PRESETS, guardSql, type Preset } from "../../lib/ask";
import { useAi } from "../../lib/useAi";

const MiniChart = lazy(() => import("../charts/MiniChart").then((m) => ({ default: m.MiniChart })));

type Phase = "writing-sql" | "running" | "answering" | "done" | "error";

interface Exchange {
  id: number;
  question: string;
  phase: Phase;
  sql?: string;
  chart?: "bar" | "line" | "none";
  columns?: string[];
  rows?: SqlValue[][];
  answer?: string;
  error?: string;
  by?: string;
}

const fmtCell = (v: SqlValue) => (v === null ? "–" : typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString("en-US") : String(v)) : String(v));

function pickMeasure(columns: string[], rows: SqlValue[][]): number {
  const numeric = (i: number) => rows.every((r) => r[i] === null || typeof r[i] === "number");
  const pref = columns.findIndex((c, i) => i > 0 && /_pct$/.test(c) && numeric(i));
  if (pref > 0) return pref;
  const hours = columns.findIndex((c, i) => i > 0 && /_h$/.test(c) && numeric(i));
  if (hours > 0) return hours;
  return columns.findIndex((_, i) => i > 0 && numeric(i));
}

function ResultView({ ex, compact }: { ex: Exchange; compact: boolean }) {
  const [showSql, setShowSql] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [copied, setCopied] = useState(false);
  if (!ex.columns || !ex.rows) return null;
  const m = pickMeasure(ex.columns, ex.rows);
  const canChart = ex.chart !== "none" && m > 0 && ex.rows.length > 1 && ex.rows.length <= 60;
  const rows = showAll ? ex.rows : ex.rows.slice(0, compact ? 6 : 10);

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-line">
      {canChart && (
        <div className="flex items-center justify-between border-b border-line bg-panel px-3 py-2">
          <p className="truncate text-xs text-muted">
            {ex.columns[m].replace(/_/g, " ")} by {ex.columns[0].replace(/_/g, " ")}
          </p>
          <div role="tablist" aria-label="Result view" className="flex rounded-md border border-line p-0.5 text-xs">
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
        </div>
      )}
      {canChart && view === "chart" ? (
        <div className="bg-panel px-2 pb-2">
          <Suspense fallback={<div className="shimmer m-2 h-[220px] rounded-lg" />}>
            <MiniChart
              type={ex.chart === "line" ? "line" : "bar"}
              labels={ex.rows.map((r) => String(r[0]))}
              values={ex.rows.map((r) => Number(r[m] ?? 0))}
              name={ex.columns[m]}
              height={compact ? 200 : 240}
            />
          </Suspense>
        </div>
      ) : (
        <div className="scroll-thin max-h-[320px] overflow-auto bg-panel">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-raised text-xs text-muted">
              <tr>
                {ex.columns.map((c) => (
                  <th key={c} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {r.map((v, j) => (
                    <td key={j} className={`whitespace-nowrap px-3 py-1.5 ${typeof v === "number" ? "num text-ink-2" : "text-ink"}`}>
                      {fmtCell(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {ex.rows.length > rows.length && (
            <button onClick={() => setShowAll(true)} className="w-full border-t border-line px-3 py-2 text-xs text-primary-ink hover:bg-raised">
              Show all {ex.rows.length} rows
            </button>
          )}
        </div>
      )}
      <div className="border-t border-line bg-panel">
        <button
          onClick={() => setShowSql((s) => !s)}
          aria-expanded={showSql}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted hover:text-ink"
        >
          <Code2 aria-hidden="true" className="h-3.5 w-3.5" />
          Query that ran in your browser
          <ChevronDown aria-hidden="true" className={`ml-auto h-3.5 w-3.5 transition-transform ${showSql ? "rotate-180" : ""}`} />
        </button>
        {showSql && (
          <div className="relative border-t border-line">
            <pre className="scroll-thin overflow-x-auto p-3 pr-12 font-mono text-[12px] leading-relaxed text-ink-2">{ex.sql}</pre>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(ex.sql ?? "").then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  },
                  () => {},
                );
              }}
              className="absolute right-2 top-2 rounded-md border border-line bg-raised p-1.5 text-muted hover:text-ink"
              aria-label="Copy query"
            >
              {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The assistant. `compact` is the version embedded on the home page.
 * `autoRun` runs one preset's query on mount (data only, so no AI call happens until someone asks).
 */
export function AskPanel({ compact = false, autoRun }: { compact?: boolean; autoRun?: number }) {
  const { db, status: dbStatus } = useDb();
  const { status: aiStatus, ai } = useAi();
  const [items, setItems] = useState<Exchange[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  const patch = (id: number, p: Partial<Exchange>) => setItems((all) => all.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const run = useCallback(
    async (question: string, preset?: Preset, opts: { dataOnly?: boolean } = {}) => {
      if (!db) return;
      const id = ++nextId.current;
      setItems((all) => [...(compact ? [] : all), { id, question, phase: preset ? "running" : "writing-sql" }]);
      setBusy(true);
      const c = new AbortController();
      ctl.current = c;
      try {
        let sql = preset?.sql;
        let chart = preset?.chart ?? "bar";
        if (!sql) {
          if (!ai) throw new AiError("Free-form questions need the AI service. Try one of the suggested questions.");
          const plan = await ai.json<{ sql?: string; chart?: "bar" | "line" | "none"; reason?: string }>("sql", { question }, { signal: c.signal });
          if (!plan?.sql) throw new AiError(plan?.reason ?? "That question can't be answered from the order data.");
          sql = plan.sql;
          chart = plan.chart ?? "bar";
        }
        const safe = guardSql(sql);
        patch(id, { phase: "running", sql: safe, chart });
        const { columns, rows } = (() => {
          const r = runQuery<Record<string, SqlValue>>(db, `SELECT * FROM (${safe}) LIMIT 200`);
          return { columns: r.columns, rows: r.rows.map((o) => r.columns.map((k) => o[k])) };
        })();
        patch(id, { columns, rows, phase: ai && !opts.dataOnly ? "answering" : "done" });
        if (ai && !opts.dataOnly) {
          const answer = await ai.text("answer", { question, sql: safe, columns, rows: rows.slice(0, 200) }, {
            signal: c.signal,
            onText: (t) => patch(id, { answer: t }),
          });
          patch(id, { answer, phase: "done", by: ai.label });
        }
      } catch (e) {
        const msg = e instanceof AiError || e instanceof Error ? e.message : "Something went wrong.";
        patch(id, { phase: "error", error: msg });
      } finally {
        setBusy(false);
        ctl.current = null;
      }
    },
    [db, ai, compact],
  );

  /** Writes the prose answer for a result that is already on screen. */
  const writeAnswer = useCallback(
    async (ex: Exchange) => {
      if (!ai || !ex.sql || !ex.columns || !ex.rows) return;
      setBusy(true);
      const c = new AbortController();
      ctl.current = c;
      patch(ex.id, { phase: "answering" });
      try {
        const answer = await ai.text("answer", { question: ex.question, sql: ex.sql, columns: ex.columns, rows: ex.rows.slice(0, 200) }, {
          signal: c.signal,
          onText: (t) => patch(ex.id, { answer: t }),
        });
        patch(ex.id, { answer, phase: "done", by: ai.label });
      } catch (e) {
        const msg = e instanceof AiError || e instanceof Error ? e.message : "Something went wrong.";
        patch(ex.id, { phase: "error", error: msg });
      } finally {
        setBusy(false);
        ctl.current = null;
      }
    },
    [ai],
  );

  // Home page: show one preset's data straight away (no AI call until someone asks).
  const ran = useRef(false);
  useEffect(() => {
    if (autoRun === undefined || ran.current || dbStatus !== "ready" || aiStatus === "checking") return;
    ran.current = true;
    const p = PRESETS[autoRun];
    run(p.q, p, { dataOnly: true });
  }, [autoRun, dbStatus, aiStatus, run]);

  useEffect(() => {
    if (!compact) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, compact]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    const preset = PRESETS.find((p) => p.q.toLowerCase() === q.toLowerCase());
    setText("");
    run(q, preset);
  };

  const offline = aiStatus === "off";
  const latest = items[items.length - 1];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`scroll-thin min-h-0 flex-1 space-y-6 overflow-y-auto ${compact ? "" : "pb-4"}`}>
        {items.length === 0 && !compact && (
          <div className="pt-6">
            <p className="text-sm text-muted">Try one of these</p>
          </div>
        )}
        {items.map((ex) => (
          <article key={ex.id} aria-live={ex === latest ? "polite" : undefined}>
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-raised px-4 py-2.5 text-[15px] text-ink">{ex.question}</p>
            <div className="mt-4 flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-panel text-primary-ink">
                <Sparkles aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                {ex.phase === "writing-sql" && <Thinking label="Writing a query" />}
                {ex.phase === "running" && <Thinking label="Running it on the order data" />}
                {ex.phase === "error" && (
                  <p className="flex items-start gap-2 text-sm text-ink-2">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-risk" />
                    {ex.error}
                  </p>
                )}
                {ex.answer ? (
                  <p className="text-[15px] leading-relaxed text-ink">{ex.answer}</p>
                ) : ex.phase === "answering" ? (
                  <Thinking label="Reading the result" />
                ) : ex.phase === "done" && !ex.answer ? (
                  ai ? (
                    <button type="button" onClick={() => writeAnswer(ex)} disabled={busy} className="btn-secondary min-h-[34px] px-3 text-[13px]">
                      <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-primary-ink" />
                      Explain this result
                    </button>
                  ) : (
                    <p className="text-sm text-muted">Here is what the data shows.</p>
                  )
                ) : null}
                <ResultView ex={ex} compact={compact} />
                {ex.by && <p className="mt-2 text-[11px] text-muted">Answer written by {ex.by} from the rows above.</p>}
              </div>
            </div>
          </article>
        ))}
        <div ref={endRef} />
      </div>

      <div className={compact ? "mt-5" : "mt-4"}>
        <div className="mb-3 flex flex-wrap gap-2">
          {PRESETS.slice(0, compact ? 3 : PRESETS.length).map((p) => (
            <button
              key={p.q}
              type="button"
              disabled={busy || dbStatus !== "ready"}
              onClick={() => run(p.q, p)}
              className="rounded-full border border-line bg-panel px-3 py-1.5 text-left text-[13px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
            >
              {p.q}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="relative">
          <label htmlFor={compact ? "ask-compact" : "ask-main"} className="sr-only">
            Ask a question about deliveries
          </label>
          <input
            id={compact ? "ask-compact" : "ask-main"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={300}
            disabled={dbStatus !== "ready"}
            placeholder={offline ? "Pick a suggested question above" : "Ask about vendors, delays, materials, alerts…"}
            className="input h-12 pr-14 text-[15px]"
            autoComplete="off"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => ctl.current?.abort()}
              className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-md bg-raised text-ink hover:bg-overlay"
              aria-label="Stop"
            >
              <Square aria-hidden="true" className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!text.trim() || offline}
              className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-fg hover:bg-primary-hover disabled:bg-raised disabled:text-muted"
              aria-label="Ask"
            >
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </form>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
          <Table2 aria-hidden="true" className="h-3 w-3" />
          {aiStatus === "checking"
            ? "Connecting to the AI service…"
            : offline
              ? "AI is offline here. Suggested questions still run on the data in your browser."
              : `Queries run in your browser. Written answers by ${ai?.label}.`}
        </p>
      </div>
    </div>
  );
}

function Thinking({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted" role="status">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-ink" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
      {label}
    </p>
  );
}
