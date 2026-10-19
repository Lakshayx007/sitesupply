import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { LIVE_COLUMNS, alertSent, earlyScore, liveScore, liveStatus, ts, type LiveOrder } from "./live";

let db: Database;
let orders: LiveOrder[];

beforeAll(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database(readFileSync(resolve(__dirname, "../../public/data/sitesupply.sqlite")));
  const res = db.exec(`SELECT ${LIVE_COLUMNS} FROM orders o JOIN vendors v USING (vendor_id)`)[0];
  orders = res.values.map((v) => Object.fromEntries(res.columns.map((c, i) => [c, v[i]])) as unknown as LiveOrder);
});

const byId = (id: string) => orders.find((o) => o.order_id === id)!;

describe("liveStatus follows the CLAUDE.md status logic", () => {
  it("hero order O01162: watch before the check, at risk after, delayed past promise, delivered late at the end", () => {
    const o = byId("O01162");
    expect(earlyScore(o)).toBe(60);
    expect(liveStatus(o, ts(o.check_ts) - 1)).toBe("watch");
    expect(liveStatus(o, ts(o.check_ts))).toBe("at-risk");
    expect(liveStatus(o, ts(o.promised_ts))).toBe("delayed");
    expect(liveStatus(o, ts(o.delivered_ts!))).toBe("delivered-late");
    expect(liveScore(o, ts(o.check_ts) - 1)).toEqual({ score: 60, full: false });
    expect(liveScore(o, ts(o.check_ts))).toEqual({ score: 100, full: true });
    expect(alertSent(o, ts(o.check_ts) - 1)).toBe(false);
    expect(alertSent(o, ts(o.check_ts))).toBe(true);
  });

  it("at the end of the window every delivered order matches its recorded status", () => {
    const end = ts("2026-09-29 00:00");
    const map: Record<string, string> = { "Delivered OTIF": "delivered", "Delivered late": "delivered-late", "Delivered short": "delivered-short" };
    const status = db.exec("SELECT order_id, status FROM orders WHERE cancelled = 0")[0].values;
    for (const [id, s] of status) expect(liveStatus(byId(String(id)), end)).toBe(map[String(s)]);
  });

  it("an alert is sent exactly for orders with alert = 1, and their full score is at least 50", () => {
    const end = ts("2026-09-29 00:00");
    const sent = orders.filter((o) => o.cancelled === 0 && alertSent(o, end));
    expect(sent.length).toBe(423);
    expect(sent.every((o) => o.risk_score >= 50)).toBe(true);
  });
});
