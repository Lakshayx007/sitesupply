/** "Ask SiteSupply": natural-language questions → SQL run in the browser → a short written answer. */

export { SCHEMA } from "../../api/_prompts.js";

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
FROM orders WHERE cancelled = 0 AND risk_score >= 50 AND pts_dispatch_late > 0 GROUP BY month ORDER BY month`,
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

export function templateVendorMessage(f: { vendor: string; material: string; qty: string; site: string; due: string; plannedOut: string }): string {
  return `Hello ${f.vendor} dispatch team, this is about ${f.qty} of ${f.material} for ${f.site}, needed at ${f.due}. The truck was due out at ${f.plannedOut} and we have no dispatch update yet. Please share the actual departure time and ETA within 15 minutes so we can re-plan the crew. Thank you, Site team`;
}
