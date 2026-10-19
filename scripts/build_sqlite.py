"""Packs the CSVs into one SQLite file that the website opens in the browser with sql.js."""
import sqlite3, pandas as pd, os
B = os.path.join(os.path.dirname(__file__), "..")
out = os.path.join(B, "public", "data", "sitesupply.sqlite")
os.makedirs(os.path.dirname(out), exist_ok=True)
if os.path.exists(out): os.remove(out)
con = sqlite3.connect(out)
for t in ["orders", "enquiries", "vendors", "customers", "materials"]:
    pd.read_csv(os.path.join(B, "data", f"{t}.csv")).to_sql(t, con, index=False)
con.execute("CREATE INDEX ix_orders_vendor ON orders(vendor_id)")
con.execute("CREATE INDEX ix_orders_customer ON orders(customer_id)")
con.commit(); con.close(); print("wrote", out, os.path.getsize(out) // 1024, "KB")
