/** "Ask SiteSupply": natural-language questions → SQL run in the browser → a short written answer. */

export const SCHEMA = `SQLite database of construction-material orders for 25 weeks (6 Apr to 27 Sep 2026).

orders (one row per order; 1,158 rows)
  order_id TEXT, customer_id TEXT, site_name TEXT ("Project 207 (Central)"), customer_type TEXT (Developer|Contractor),
  vendor_id TEXT (VA..VL), material_id TEXT (M1..M6), material TEXT, unit TEXT (bags|tonnes|m3),
  qty_ordered INTEGER, qty_delivered REAL,
  order_ts, promised_ts, dispatch_planned_ts, dispatch_actual_ts, check_ts, delivered_ts, paid_ts TEXT ("YYYY-MM-DD HH:MM"),
  distance_km REAL, short_notice INTEGER (1 = ordered under 24 h before need), monsoon INTEGER (1 = June to September),
  cancelled INTEGER (1 = cancelled; use cancelled = 0 for delivered orders),
  delay_hours REAL (hours late, 0 if on time), on_time REAL (1/0), in_full REAL (1/0), otif REAL (1 = on time AND in full),
  dispatch_late REAL (1/0), vendor_recent_otif REAL (vendor OTIF over its last 10 orders before the check),
  risk_score INTEGER (0-100), alert INTEGER (1 = alert sent, risk_score >= 50), alert_lead_hours REAL,
  pts_dispatch_late, pts_vendor_recent_otif_below_80, pts_distance_over_50km, pts_ordered_under_24h, pts_monsoon INTEGER,
  status TEXT (Delivered OTIF | Delivered late | Delivered short | Cancelled)
vendors: vendor_id, vendor_name ("Vendor A".."Vendor L"), materials TEXT ("M1|M2"), joined TEXT, price_index REAL, zone TEXT
materials: material_id, material, unit, qty_min, qty_max
customers: customer_id, customer_type, site_zone, site_id, site_name
enquiries: enquiry_id, customer_id, enquiry_date TEXT ("YYYY-MM-DD"), material_id, quoted INTEGER, ordered INTEGER

Definitions: OTIF rate = AVG(otif) over cancelled = 0. Late = on_time = 0. Week number =
CAST((julianday(substr(promised_ts,1,10)) - julianday('2026-04-06')) / 7 AS INT) + 1. Month = substr(promised_ts,1,7).
Alert precision = late orders among alerts / alerts; recall = alerted late orders / late orders.`;

export interface Preset {
  q: string;
  sql: string;
  chart: "bar" | "line" | "none";
}

export const PRESETS: Preset[] = [
  {
    q: "Which vendors are late most often in the monsoon?",
    chart: "bar",
    sql: `SELECT v.vendor_name AS vendor, COUNT(*) AS orders, ROUND(100.0 * AVG(1 - o.on_time), 1) AS late_pct
FROM orders o JOIN vendors v USING (vendor_id)
WHERE o.cancelled = 0 AND o.monsoon = 1
GROUP BY o.vendor_id ORDER BY late_pct DESC`,
  },
  {
    q: "How did OTIF change week by week?",
    chart: "line",
    sql: `SELECT CAST((julianday(substr(promised_ts,1,10)) - julianday('2026-04-06')) / 7 AS INT) + 1 AS week,
       COUNT(*) AS orders, ROUND(100.0 * AVG(otif), 1) AS otif_pct
FROM orders WHERE cancelled = 0 GROUP BY week ORDER BY week`,
  },
  {
    q: "Which materials have the highest late rate?",
    chart: "bar",
    sql: `SELECT material, COUNT(*) AS orders, ROUND(100.0 * AVG(1 - on_time), 1) AS late_pct, ROUND(100.0 * AVG(otif), 1) AS otif_pct
FROM orders WHERE cancelled = 0 GROUP BY material ORDER BY late_pct DESC`,
  },
  {
    q: "How many alerts went out each month, and how many were right?",
    chart: "bar",
    sql: `SELECT substr(check_ts, 1, 7) AS month, COUNT(*) AS alerts, SUM(on_time = 0) AS right_alerts,
       ROUND(100.0 * AVG(on_time = 0), 1) AS precision_pct
FROM orders WHERE cancelled = 0 AND alert = 1 GROUP BY month ORDER BY month`,
  },
  {
    q: "How late are ready-mix concrete deliveries by vendor?",
    chart: "bar",
    sql: `SELECT v.vendor_name AS vendor, COUNT(*) AS late_orders, ROUND(AVG(o.delay_hours), 1) AS avg_delay_h,
       ROUND(MAX(o.delay_hours), 1) AS worst_delay_h
FROM orders o JOIN vendors v USING (vendor_id)
WHERE o.cancelled = 0 AND o.material_id = 'M4' AND o.on_time = 0
GROUP BY o.vendor_id ORDER BY avg_delay_h DESC`,
  },
  {
    q: "Do long routes make deliveries late?",
    chart: "bar",
    sql: `SELECT CASE WHEN distance_km > 50 THEN 'Over 50 km' ELSE '50 km or less' END AS route,
       COUNT(*) AS orders, ROUND(100.0 * AVG(1 - on_time), 1) AS late_pct
FROM orders WHERE cancelled = 0 GROUP BY route ORDER BY route`,
  },
];

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|attach|detach|pragma|replace|vacuum|reindex|begin|commit|rollback|savepoint|release)\b/i;

/** Accepts one read-only SELECT (or WITH … SELECT). Returns the cleaned SQL or throws a readable error. */
export function guardSql(sql: string): string {
  const s = sql.trim().replace(/;\s*$/, "");
  if (!/^(select|with)\b/i.test(s)) throw new Error("Only SELECT queries can run here.");
  if (s.includes(";")) throw new Error("Only one query can run at a time.");
  if (FORBIDDEN.test(s.replace(/'[^']*'/g, "''"))) throw new Error("That query tries to change data, so it was not run.");
  return s;
}

export function sqlPrompt(question: string): string {
  return `You turn questions about construction deliveries into one SQLite query.

${SCHEMA}

Rules:
- One read-only SELECT (CTEs allowed). SQLite syntax only. No semicolons.
- Use cancelled = 0 unless the question is about cancellations.
- Give columns short snake_case aliases. Percentages as ROUND(100.0 * ..., 1) with a _pct suffix.
- Put the label column first and the main measure second. Order the rows usefully. LIMIT 50 at most.
- Use vendor_name from vendors (join on vendor_id) when showing vendors.

Reply with only JSON: {"sql": "...", "chart": "bar" | "line" | "none", "title": "short chart title"}.
Use "line" for a time series, "bar" for comparing groups, "none" for a single number or a long list.
If the data cannot answer the question, reply {"sql": "", "chart": "none", "title": "", "reason": "one sentence"}.

Question: ${question}`;
}

export function answerPrompt(question: string, sql: string, columns: string[], rows: unknown[][]): string {
  const csv = [columns.join(","), ...rows.slice(0, 40).map((r) => r.map((v) => (v === null ? "" : String(v))).join(","))].join("\n");
  return `You are SiteSupply's delivery analyst. Answer the question for an operations manager in 2 to 4 plain sentences.
Use only the numbers in the result below, rounded sensibly. Lead with the direct answer, then the most useful comparison.
No headings, no bullet points, no markdown, no preamble. Do not mention SQL.

Question: ${question}
Query: ${sql}
Result (${rows.length} rows${rows.length > 40 ? ", first 40 shown" : ""}):
${csv}`;
}

export function vendorMessagePrompt(facts: {
  vendor: string;
  material: string;
  qty: string;
  site: string;
  due: string;
  plannedOut: string;
  reasons: string[];
}): string {
  return `Write a short WhatsApp message from a site engineer to ${facts.vendor}'s dispatch desk.
Order: ${facts.qty} of ${facts.material} for ${facts.site}, needed at ${facts.due}. Truck was due out at ${facts.plannedOut}.
Our system flags it as likely late because: ${facts.reasons.join(" ")}
Ask for the truck's real departure time and ETA, and say we need to know within 15 minutes to re-plan the crew.
Polite, firm, under 70 words, no emojis, no subject line, sign off as "Site team". Reply with the message only.`;
}

export function templateVendorMessage(f: { vendor: string; material: string; qty: string; site: string; due: string; plannedOut: string }): string {
  return `Hello ${f.vendor} dispatch team, this is about ${f.qty} of ${f.material} for ${f.site}, needed at ${f.due}. The truck was due out at ${f.plannedOut} and we have no dispatch update yet. Please share the actual departure time and ETA within 15 minutes so we can re-plan the crew. Thank you, Site team`;
}
