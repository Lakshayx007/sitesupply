"""SiteSupply sample data generator (seed 42).
All data is SYNTHETIC. Patterns are PLANTED on purpose and documented in data/README_data.md.
Usage: python scripts/make_sample_data.py   -> writes CSV + JSON into data/
"""
import numpy as np, pandas as pd, json, os
from datetime import datetime, timedelta

rng = np.random.default_rng(42)
OUT = os.path.join(os.path.dirname(__file__), "..", "data")
START = datetime(2026, 4, 6)          # Monday
DAYS = 175                            # 25 weeks -> ends 2026-09-27
END = START + timedelta(days=DAYS)
def monsoon(d): return 6 <= d.month <= 9   # South-west monsoon, June-September

# ---------------- materials ----------------
MATERIALS = pd.DataFrame([
    ("M1", "OPC cement 53 grade", "bags", 200, 1200),
    ("M2", "PPC cement",          "bags", 200, 1000),
    ("M3", "TMT steel bars",      "tonnes", 5, 40),
    ("M4", "Ready-mix concrete M25", "m3", 6, 60),
    ("M5", "20 mm aggregate",     "tonnes", 20, 120),
    ("M6", "M-sand",              "tonnes", 20, 120),
], columns=["material_id", "material", "unit", "qty_min", "qty_max"])

# ---------------- vendors ----------------
# reliability_logit: vendor-specific baseline. Vendor G and K are the PLANTED unreliable vendors.
# Vendor L is a PLANTED new vendor who joins on 2026-08-03 (few orders -> used to teach shrinkage).
vend_rows = [
    ("VA", "Vendor A", ["M1", "M2"],        -0.2, START),
    ("VB", "Vendor B", ["M3"],              -0.3, START),
    ("VC", "Vendor C", ["M4"],              -0.1, START),
    ("VD", "Vendor D", ["M5", "M6"],        -0.2, START),
    ("VE", "Vendor E", ["M1", "M3"],        -0.4, START),
    ("VF", "Vendor F", ["M4"],              -0.3, START),
    ("VG", "Vendor G", ["M1", "M2", "M5"],   1.0, START),   # unreliable
    ("VH", "Vendor H", ["M5", "M6"],        -0.3, START),
    ("VI", "Vendor I", ["M2", "M6"],        -0.2, START),
    ("VJ", "Vendor J", ["M3", "M4"],        -0.1, START),
    ("VK", "Vendor K", ["M3", "M4", "M6"],   0.9, START),   # unreliable
    ("VL", "Vendor L", ["M1", "M5"],        -0.3, datetime(2026, 8, 3)),  # new vendor
]
VENDORS = pd.DataFrame(vend_rows, columns=["vendor_id", "vendor_name", "materials", "rel_logit", "joined"])
# Unreliable vendors are a bit cheaper, so they keep winning orders (a realistic reason the problem persists)
VENDORS["price_index"] = np.where(VENDORS.vendor_id.isin(["VG", "VK"]), 0.95, rng.uniform(0.99, 1.06, len(VENDORS))).round(3)
VENDORS["zone"] = rng.choice(["North", "South", "East", "West", "Central"], len(VENDORS))

# ---------------- customers (one active project site each) ----------------
N_CUST = 300
zones = ["North", "South", "East", "West", "Central"]
CUST = pd.DataFrame({
    "customer_id": [f"C{i:03d}" for i in range(1, N_CUST + 1)],
    "customer_type": rng.choice(["Developer", "Contractor"], N_CUST, p=[0.4, 0.6]),
    "site_zone": rng.choice(zones, N_CUST),
})
CUST["site_id"] = [f"S{i:03d}" for i in range(1, N_CUST + 1)]
CUST["site_name"] = [f"Project {i:03d} ({z})" for i, z in zip(range(1, N_CUST + 1), CUST.site_zone)]
CUST["base_rate"] = np.where(CUST.customer_type == "Developer", rng.uniform(0.07, 0.12, N_CUST), rng.uniform(0.05, 0.09, N_CUST))
# preferred material mix per customer
mix = rng.dirichlet(np.ones(6) * 1.2, N_CUST)

# distance (km) for every vendor-site pair: fixed geography
DIST = {(v, s): float(np.round(rng.uniform(6, 90) if True else 0, 1)) for v in VENDORS.vendor_id for s in CUST.site_id}

# ---------------- simulation ----------------
enquiries, orders = [], []
penalty_until = {c: START - timedelta(days=1) for c in CUST.customer_id}   # after a failed delivery, demand drops (PLANTED)
pending_effects = []   # (effective_date, customer_id) when a late/short delivery is experienced
eq_id = ord_id = 0
for day in range(DAYS):
    d = START + timedelta(days=day)
    # apply experiences that have happened by today
    for eff in [e for e in pending_effects if e[0] <= d]:
        penalty_until[eff[1]] = max(penalty_until[eff[1]], eff[0] + timedelta(days=30))
        pending_effects.remove(eff)
    season = 0.85 if monsoon(d) else 1.0      # construction slows a little in monsoon
    weekday = 0.35 if d.weekday() == 6 else 1.0
    for i, c in CUST.iterrows():
        rate = c.base_rate * season * weekday * (0.6 if d < penalty_until[c.customer_id] else 1.0)
        if rng.random() >= rate:
            continue
        eq_id += 1
        mat = MATERIALS.material_id[rng.choice(6, p=mix[i])]
        quoted = rng.random() < 0.82
        ordered = quoted and rng.random() < 0.46
        enquiries.append(dict(enquiry_id=f"E{eq_id:05d}", customer_id=c.customer_id, enquiry_date=d.date().isoformat(),
                              material_id=mat, quoted=int(quoted), ordered=int(ordered)))
        if not ordered:
            continue
        ord_id += 1
        cands = VENDORS[VENDORS.materials.apply(lambda m: mat in m) & (VENDORS.joined <= d)]
        w = (1 / cands.price_index.values) ** 4
        v = cands.iloc[rng.choice(len(cands), p=w / w.sum())]
        mrow = MATERIALS.set_index("material_id").loc[mat]
        qty = int(rng.integers(mrow.qty_min, mrow.qty_max + 1))
        order_ts = d + timedelta(days=int(rng.integers(0, 3)), hours=float(rng.uniform(9, 19)))
        short_notice = rng.random() < 0.18
        lead_h = rng.uniform(10, 23) if short_notice else rng.uniform(48, 168)
        promised = order_ts + timedelta(hours=lead_h)
        dist = DIST[(v.vendor_id, c.site_id)]
        travel_h = dist / 25 + 1.0
        dispatch_planned = promised - timedelta(hours=travel_h)
        orders.append(dict(order_id=f"O{ord_id:05d}", enquiry_id=f"E{eq_id:05d}", customer_id=c.customer_id,
                           customer_type=c.customer_type, site_id=c.site_id, site_name=c.site_name,
                           vendor_id=v.vendor_id, material_id=mat, material=mrow.material, unit=mrow.unit,
                           qty_ordered=qty, order_ts=order_ts, promised_ts=promised, dispatch_planned_ts=dispatch_planned,
                           distance_km=dist, short_notice=int(short_notice), monsoon=int(monsoon(promised)),
                           _rel=v.rel_logit))
        o = orders[-1]
        # ---- outcome model (PLANTED effects on the log-odds of being late) ----
        logit = (-2.3 + o["_rel"] + 0.8 * o["monsoon"] + 0.6 * (dist > 50) + 0.7 * o["short_notice"]
                 + (0.3 if mat == "M4" else 0.0))
        late = rng.random() < 1 / (1 + np.exp(-logit))
        cancelled = rng.random() < 0.02
        o["cancelled"] = int(cancelled)
        if cancelled:
            for k in ["dispatch_actual_ts", "delivered_ts", "qty_delivered", "delay_hours"]: o[k] = None
            continue
        if late:
            delay = float(np.exp(rng.normal(np.log(6), 0.9))) * (1.3 if o["monsoon"] else 1.0)
            # most late orders show up first as a late dispatch; ~20% leave on time and get stuck in transit
            dispatch_delay = delay * rng.uniform(0.5, 1.0) if rng.random() < 0.8 else rng.uniform(0, 0.8)
            delivered = promised + timedelta(hours=delay)
        else:
            dispatch_delay = rng.uniform(1.1, 2.0) if rng.random() < 0.12 else rng.uniform(-1.0, 0.8)
            D = dist / 25
            dispatch_delay = min(dispatch_delay, 0.6 + 0.3 * D)   # a late dispatch can only still arrive on time if the trip has slack
            early = rng.uniform(0, max(0.0, 0.8 + 0.3 * D - max(dispatch_delay, 0)))
            delay = -float(early)
            delivered = promised + timedelta(hours=delay)
        short_p = 0.12 if v.vendor_id in ("VG", "VK") else 0.05
        qd = qty if rng.random() >= short_p else int(qty * rng.uniform(0.85, 0.97))
        o.update(dispatch_actual_ts=dispatch_planned + timedelta(hours=dispatch_delay), delivered_ts=delivered,
                 qty_delivered=qd, delay_hours=round(max(delay, 0.0), 2))
        on_time = delay <= 0; in_full = qd >= qty
        if not (on_time and in_full):
            pending_effects.append((delivered, c.customer_id))

E = pd.DataFrame(enquiries)
O = pd.DataFrame(orders)
O = O[O.order_ts < END - timedelta(days=0)]
O = O[O.promised_ts < END].copy()   # keep only orders due inside the window
E = E[E.enquiry_id.isin(O.enquiry_id) | (E.ordered == 0)]

# derived fields
done = O.cancelled == 0
O["on_time"] = np.where(done, (O.delay_hours.fillna(0) <= 0).astype(int), np.nan)
O["in_full"] = np.where(done, (O.qty_delivered.fillna(0) >= O.qty_ordered).astype(int), np.nan)
O["otif"] = np.where(done, O.on_time * O.in_full, np.nan)
O["delivered_ts"] = pd.to_datetime(O.delivered_ts); O["dispatch_actual_ts"] = pd.to_datetime(O.dispatch_actual_ts)
O["dispatch_late"] = np.where(done, ((O.dispatch_actual_ts - O.dispatch_planned_ts).dt.total_seconds() / 3600 > 1).astype(float), np.nan)

# ---------------- rule-based delay-risk score, computed as it would be live ----------------
# Check time = 1 hour after planned dispatch. Vendor history uses only orders DELIVERED before check time (no peeking).
O = O.sort_values("dispatch_planned_ts").reset_index(drop=True)
O["check_ts"] = O.dispatch_planned_ts + pd.Timedelta(hours=1)
vend_recent, score, pts = [], [], []
for i, o in O.iterrows():
    hist = O[(O.vendor_id == o.vendor_id) & (O.cancelled == 0) & (O.delivered_ts < o.check_ts)].sort_values("delivered_ts").tail(10)
    r = hist.otif.mean() if len(hist) >= 5 else np.nan
    vend_recent.append(r)
    p = dict(dispatch_late=40 if o.dispatch_late == 1 else 0,
             vendor_recent_otif_below_80=25 if (not np.isnan(r) and r < 0.8) else 0,
             distance_over_50km=15 if o.distance_km > 50 else 0,
             ordered_under_24h=10 if o.short_notice == 1 else 0,
             monsoon=10 if o.monsoon == 1 else 0)
    pts.append(p); score.append(sum(p.values()))
O["vendor_recent_otif"] = np.round(vend_recent, 3)
O["risk_score"] = score
for k in pts[0]: O[f"pts_{k}"] = [p[k] for p in pts]
O["alert"] = np.where(O.cancelled == 0, (O.risk_score >= 50).astype(int), 0)
O["alert_lead_hours"] = np.where(O.alert == 1, ((O.promised_ts - O.check_ts).dt.total_seconds() / 3600).round(2), np.nan)

# ---------------- payment (for the funnel) ----------------
pay_days = rng.gamma(4, 13, len(O)) + np.where(O.in_full == 0, 20, 0)   # short deliveries get disputed -> slower payment
O["delivered_ts"] = pd.to_datetime(O.delivered_ts); O["dispatch_actual_ts"] = pd.to_datetime(O.dispatch_actual_ts)
O["paid_ts"] = (O.delivered_ts + pd.to_timedelta(pay_days, unit="D")).where(O.cancelled == 0)
O.loc[O.paid_ts > END, "paid_ts"] = pd.NaT   # not yet paid at data cut-off

O["status"] = np.select([O.cancelled == 1, O.otif == 1, O.on_time == 1, O.on_time == 0],
                        ["Cancelled", "Delivered OTIF", "Delivered short", "Delivered late"], "Unknown")
O = O.drop(columns=["_rel"]).sort_values("order_ts").reset_index(drop=True)
for c in ["order_ts", "promised_ts", "dispatch_planned_ts", "dispatch_actual_ts", "delivered_ts", "check_ts", "paid_ts"]:
    O[c] = pd.to_datetime(O[c]).dt.strftime("%Y-%m-%d %H:%M")

os.makedirs(OUT, exist_ok=True)
V = VENDORS.copy(); V["materials"] = V.materials.apply(lambda m: "|".join(m)); V["joined"] = V.joined.dt.date
V.drop(columns=["rel_logit"]).to_csv(f"{OUT}/vendors.csv", index=False)
MATERIALS.to_csv(f"{OUT}/materials.csv", index=False)
CUST.drop(columns=["base_rate"]).to_csv(f"{OUT}/customers.csv", index=False)
E.to_csv(f"{OUT}/enquiries.csv", index=False)
O.to_csv(f"{OUT}/orders.csv", index=False)
print("enquiries", len(E), "orders", len(O), "delivered", int(done.sum()) if False else int((O.cancelled == 0).sum()))
