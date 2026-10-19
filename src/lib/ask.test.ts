import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import { PRESETS, guardSql } from "./ask";

describe("Ask SiteSupply", () => {
  it("every preset question runs and returns rows", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database(readFileSync(resolve(__dirname, "../../public/data/sitesupply.sqlite")));
    for (const p of PRESETS) {
      const res = db.exec(guardSql(p.sql));
      expect(res[0]?.values.length, p.q).toBeGreaterThan(1);
    }
  });

  it("guardSql only lets read-only single queries through", () => {
    expect(guardSql("SELECT 1;")).toBe("SELECT 1");
    expect(guardSql("with x as (select 1) select * from x")).toContain("with");
    expect(() => guardSql("DELETE FROM orders")).toThrow();
    expect(() => guardSql("SELECT 1; DROP TABLE orders")).toThrow();
    expect(() => guardSql("SELECT * FROM orders WHERE 1; ATTACH 'x' AS y")).toThrow();
    expect(() => guardSql("PRAGMA table_info(orders)")).toThrow();
    // words inside string literals are fine
    expect(guardSql("SELECT 'update' AS word")).toBe("SELECT 'update' AS word");
  });
});
