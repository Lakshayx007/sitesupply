/**
 * These tests open the same SQLite file the website uses (public/data/sitesupply.sqlite)
 * and check that src/lib/stats.ts reproduces data/stats_summary.json.
 * Tolerance: ±0.002. If a test fails, fix the code, not the expected value.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import {
  confusion,
  mean,
  median,
  normCdf,
  normInv,
  pchartLimits,
  percentile,
  sampleSizeTwoProportions,
  shrink,
  wilson,
} from "./stats";

const ROOT = resolve(__dirname, "../..");
const summary = JSON.parse(readFileSync(resolve(ROOT, "data/stats_summary.json"), "utf8"));
const TOL = 0.002;

let db: Database;

function column(sql: string): number[] {
  const res = db.exec(sql);
  if (!res.length) return [];
  return res[0].values.map((r) => (r[0] === null ? NaN : Number(r[0])));
}

function rows(sql: string): Record<string, number | string>[] {
  const res = db.exec(sql);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map((v) => Object.fromEntries(columns.map((c, i) => [c, v[i] as number | string])));
}

function close(actual: number, expected: number, tol = TOL) {
  expect(Math.abs(actual - expected), `expected ${actual} ≈ ${expected} (±${tol})`).toBeLessThanOrEqual(tol);
}

beforeAll(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database(readFileSync(resolve(ROOT, "public/data/sitesupply.sqlite")));
});

describe("normal distribution helpers", () => {
  it("normInv matches known quantiles", () => {
    close(normInv(0.975), 1.959964, 1e-6);
    close(normInv(0.8), 0.841621, 1e-6);
    close(normInv(0.5), 0, 1e-9);
    close(normInv(0.01), -2.326348, 1e-6);
  });
  it("normCdf is the inverse of normInv", () => {
    for (const p of [0.025, 0.2, 0.5, 0.8, 0.975]) close(normCdf(normInv(p)), p, 1e-6);
  });
});

describe("headline rates (stats_summary.headline)", () => {
  it("OTIF is 0.700 over 1,138 delivered orders", () => {
    const otif = column("SELECT otif FROM orders WHERE cancelled = 0");
    expect(otif.length).toBe(summary.headline.delivered);
    close(mean(otif), 0.7);
    close(mean(otif), summary.headline.otif);
  });

  it("on-time and in-full rates", () => {
    close(mean(column("SELECT on_time FROM orders WHERE cancelled = 0")), summary.headline.on_time);
    close(mean(column("SELECT in_full FROM orders WHERE cancelled = 0")), summary.headline.in_full);
  });

  it("delay median, mean and P90 for late orders (pandas-style percentile)", () => {
    const delays = column("SELECT delay_hours FROM orders WHERE cancelled = 0 AND on_time = 0");
    expect(delays.length).toBe(summary.headline.late_orders);
    close(median(delays), summary.headline.delay_median_h, 0.05);
    close(mean(delays), summary.headline.delay_mean_h, 0.05);
    close(percentile(delays, 90), summary.headline.delay_p90_h, 0.05);
  });
});

describe("percentile", () => {
  it("interpolates linearly like pandas.quantile", () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 90)).toBeCloseTo(3.7, 10);
    expect(percentile([10], 25)).toBe(10);
    expect(percentile([3, 1, 2], 0)).toBe(1);
    expect(percentile([3, 1, 2], 100)).toBe(3);
    expect(Number.isNaN(percentile([], 50))).toBe(true);
  });
  it("ignores missing values", () => {
    expect(percentile([1, NaN, 3], 50)).toBe(2);
  });
  it("reproduces the score-alone alert lead-time median of 2.5 h", () => {
    const lead = column("SELECT alert_lead_hours FROM orders WHERE cancelled = 0 AND alert = 1");
    close(median(lead), summary.alert_at_50.lead_median_h, 0.05);
    close(percentile(lead, 25), summary.alert_at_50.lead_p25_h, 0.05);
    close(percentile(lead, 75), summary.alert_at_50.lead_p75_h, 0.05);
  });
  it("gives a median lead of about 2.3 h with the current rule (score 50+ and truck late)", () => {
    const lead = column("SELECT alert_lead_hours FROM orders WHERE cancelled = 0 AND risk_score >= 50 AND pts_dispatch_late > 0");
    close(median(lead), 2.29, 0.01);
  });
});

describe("confusion (alert precision and recall)", () => {
  const load = () => {
    const r = rows("SELECT risk_score, on_time FROM orders WHERE cancelled = 0");
    return { scores: r.map((x) => Number(x.risk_score)), late: r.map((x) => 1 - Number(x.on_time)) };
  };

  it("threshold 50: precision 0.556, recall 0.830", () => {
    const { scores, late } = load();
    const c = confusion(scores, late, 50);
    close(c.precision, 0.556);
    close(c.recall, 0.83);
    expect(c.tp).toBe(summary.alert_at_50.tp);
    expect(c.fp).toBe(summary.alert_at_50.fp);
    expect(c.fn).toBe(summary.alert_at_50.fn);
    expect(c.tp + c.fp + c.fn + c.tn).toBe(summary.headline.delivered);
  });

  it("matches every row of the threshold sweep (20–90)", () => {
    const { scores, late } = load();
    for (const row of summary.alert_sweep) {
      const c = confusion(scores, late, row.threshold);
      expect(c.tp + c.fp, `alerts at ${row.threshold}`).toBe(row.alerts);
      close(c.precision, row.precision);
      close(c.recall, row.recall);
      close((c.tp + c.fp) / 25, row.alerts_per_week, 0.05);
    }
  });

  it("early watch at order time (score ≥ 25 without the dispatch points)", () => {
    const r = rows(`SELECT pts_vendor_recent_otif_below_80 + pts_distance_over_50km + pts_ordered_under_24h + pts_monsoon AS s1,
                           on_time FROM orders WHERE cancelled = 0`);
    const c = confusion(
      r.map((x) => Number(x.s1)),
      r.map((x) => 1 - Number(x.on_time)),
      25,
    );
    close(c.precision, summary.watchlist_at_order.precision);
    close(c.recall, summary.watchlist_at_order.recall);
  });

  it("handles no alerts without dividing by zero", () => {
    const c = confusion([10, 20], [1, 0], 99);
    expect(c).toEqual({ tp: 0, fp: 0, fn: 1, tn: 1, precision: 0, recall: 0 });
  });
});

describe("wilson and shrink (vendor scorecard)", () => {
  it("Vendor L: Wilson range 0.454–0.828, shrunk 0.683 with k = 20", () => {
    const [{ n, s }] = rows("SELECT COUNT(*) AS n, SUM(otif) AS s FROM orders WHERE cancelled = 0 AND vendor_id = 'VL'");
    expect(Number(n)).toBe(21);
    const [lo, hi] = wilson(Number(s), Number(n));
    close(lo, 0.454);
    close(hi, 0.828);
    const pbar = mean(column("SELECT otif FROM orders WHERE cancelled = 0"));
    close(shrink(Number(s), Number(n), pbar, 20), 0.683);
  });

  it("matches all 12 vendors in stats_summary.json", () => {
    const pbar = mean(column("SELECT otif FROM orders WHERE cancelled = 0"));
    const k = summary.shrinkage_prior_strength;
    const byVendor = new Map(
      rows("SELECT vendor_id, COUNT(*) AS n, SUM(otif) AS s FROM orders WHERE cancelled = 0 GROUP BY vendor_id").map((r) => [r.vendor_id, r]),
    );
    expect(byVendor.size).toBe(12);
    for (const v of summary.vendors) {
      const r = byVendor.get(v.vendor_id)!;
      const n = Number(r.n);
      const s = Number(r.s);
      expect(n).toBe(v.n);
      const [lo, hi] = wilson(s, n);
      close(s / n, v.otif);
      close(lo, v.ci_lo);
      close(hi, v.ci_hi);
      close(shrink(s, n, pbar, k), v.otif_shrunk);
    }
  });

  it("edge cases", () => {
    expect(wilson(0, 0)).toEqual([0, 1]);
    const [lo, hi] = wilson(0, 10);
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(0.2);
    expect(shrink(0, 0, 0.7, 20)).toBeCloseTo(0.7, 10);
    expect(shrink(5, 10, 0.7, 0)).toBe(0.5);
  });
});

describe("sampleSizeTwoProportions (A/B sizing)", () => {
  it("about 1,089 per arm for 0.751 → 0.801 (alpha 0.05, power 0.8)", () => {
    const n = sampleSizeTwoProportions(0.751, 0.801, 0.05, 0.8);
    expect(Math.abs(n - 1089)).toBeLessThanOrEqual(2);
  });

  it("matches both rows of ab_sizing, including weeks at current volume", () => {
    const perWeek = summary.headline.delivered / summary.headline.weeks;
    for (const row of summary.ab_sizing) {
      const n = sampleSizeTwoProportions(row.baseline, row.baseline + row.mde, 0.05, 0.8);
      expect(Math.abs(n - row.n_per_arm)).toBeLessThanOrEqual(2);
      close((2 * n) / perWeek, row.weeks_at_current_volume, 0.1);
    }
  });

  it("is symmetric and grows as the effect shrinks", () => {
    expect(sampleSizeTwoProportions(0.8, 0.75)).toBe(sampleSizeTwoProportions(0.75, 0.8));
    expect(sampleSizeTwoProportions(0.75, 0.77)).toBeGreaterThan(sampleSizeTwoProportions(0.75, 0.8));
    expect(sampleSizeTwoProportions(0.75, 0.75)).toBe(Infinity);
  });
});

describe("pchartLimits (weekly OTIF control chart)", () => {
  it("reproduces data/weekly_otif.csv for every week", () => {
    const csv = readFileSync(resolve(ROOT, "data/weekly_otif.csv"), "utf8").trim().split(/\r?\n/);
    const header = csv[0].split(",");
    const weeks = csv.slice(1).map((line) => Object.fromEntries(line.split(",").map((v, i) => [header[i], Number(v)])));
    const live = rows(`SELECT CAST((julianday(substr(promised_ts,1,10)) - julianday('2026-04-06')) / 7 AS INT) + 1 AS week,
                              COUNT(*) AS n, AVG(otif) AS otif
                       FROM orders WHERE cancelled = 0 GROUP BY week ORDER BY week`);
    expect(live.length).toBe(weeks.length);
    const pbar = mean(column("SELECT otif FROM orders WHERE cancelled = 0"));
    let outside = 0;
    weeks.forEach((w, i) => {
      expect(Number(live[i].n)).toBe(w.n);
      close(Number(live[i].otif), w.otif);
      const [lcl, ucl] = pchartLimits(pbar, w.n);
      close(lcl, w.lcl);
      close(ucl, w.ucl);
      if (w.otif < lcl || w.otif > ucl) outside++;
    });
    // stats_summary.json: no week fell outside the band.
    expect(outside).toBe(summary.pchart.weeks_below_lcl.length + summary.pchart.weeks_above_ucl.length);
  });

  it("clips to [0, 1]", () => {
    expect(pchartLimits(0.99, 1)).toEqual([expect.any(Number), 1]);
    expect(pchartLimits(0.01, 1)[0]).toBe(0);
  });
});
