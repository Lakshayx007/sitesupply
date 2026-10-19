"""SiteSupply statistics on SAMPLE data. Writes data/stats_summary.json and figs/*.png"""
import pandas as pd, numpy as np, json, os
from scipy import stats
import statsmodels.api as sm
from statsmodels.stats.proportion import proportion_confint, proportions_ztest
from statsmodels.stats.power import NormalIndPower
from statsmodels.stats.proportion import proportion_effectsize

D = os.path.join(os.path.dirname(__file__), "..", "data")
O = pd.read_csv(f"{D}/orders.csv", parse_dates=["order_ts","promised_ts","dispatch_planned_ts","dispatch_actual_ts","delivered_ts","check_ts","paid_ts"])
E = pd.read_csv(f"{D}/enquiries.csv", parse_dates=["enquiry_date"])
END = pd.Timestamp("2026-09-28")
d = O[O.cancelled == 0].copy()
d["late"] = 1 - d.on_time
S = {}

# A. headline
late = d[d.late == 1]
S["headline"] = dict(orders=len(O), delivered=len(d), cancelled=int(O.cancelled.sum()), enquiries=len(E),
    otif=round(d.otif.mean(), 3), on_time=round(d.on_time.mean(), 3), in_full=round(d.in_full.mean(), 3),
    late_orders=len(late), delay_median_h=round(late.delay_hours.median(), 1), delay_mean_h=round(late.delay_hours.mean(), 1),
    delay_p90_h=round(late.delay_hours.quantile(0.9), 1), weeks=25, orders_per_week=round(len(d) / 25, 1))

# B. weekly OTIF p-chart
d["week"] = ((d.promised_ts - pd.Timestamp("2026-04-06")).dt.days // 7) + 1
w = d.groupby("week").agg(n=("otif", "size"), otif=("otif", "mean")).reset_index()
pbar = d.otif.mean()
w["lcl"] = (pbar - 3 * np.sqrt(pbar * (1 - pbar) / w.n)).clip(0)
w["ucl"] = (pbar + 3 * np.sqrt(pbar * (1 - pbar) / w.n)).clip(upper=1)
w["out"] = ((w.otif < w.lcl) | (w.otif > w.ucl)).astype(int)
S["pchart"] = dict(pbar=round(pbar, 3), weeks_below_lcl=w[w.otif < w.lcl].week.tolist(), weeks_above_ucl=w[w.otif > w.ucl].week.tolist(),
                   pre_monsoon_otif=round(d[d.monsoon == 0].otif.mean(), 3), monsoon_otif=round(d[d.monsoon == 1].otif.mean(), 3))
w.round(3).to_csv(f"{D}/weekly_otif.csv", index=False)

# C. vendors: Wilson CI + empirical-Bayes (beta-binomial) shrinkage
g = d.groupby("vendor_id").agg(n=("otif", "size"), s=("otif", "sum"), avg_delay_h=("delay_hours", lambda x: x[x > 0].mean())).reset_index()
g["otif"] = g.s / g.n
lo, hi = proportion_confint(g.s, g.n, method="wilson")
g["ci_lo"], g["ci_hi"] = lo, hi
K = 20  # prior strength = "20 orders' worth" of the average vendor
a0, b0 = pbar * K, (1 - pbar) * K
g["otif_shrunk"] = (g.s + a0) / (g.n + a0 + b0)
g = g.round(3).sort_values("otif_shrunk")
g.to_csv(f"{D}/vendor_stats.csv", index=False)
S["vendors"] = g.to_dict("records"); S["shrinkage_prior_strength"] = K

# D. monsoon vs dry season late rate
ct = pd.crosstab(d.monsoon, d.late)
chi2, p, _, _ = stats.chi2_contingency(ct, correction=False)
r1, r0 = d[d.monsoon == 1].late.mean(), d[d.monsoon == 0].late.mean()
n1, n0 = (d.monsoon == 1).sum(), (d.monsoon == 0).sum()
se = np.sqrt(r1 * (1 - r1) / n1 + r0 * (1 - r0) / n0)
S["monsoon_test"] = dict(late_rate_monsoon=round(r1, 3), late_rate_dry=round(r0, 3), n_monsoon=int(n1), n_dry=int(n0),
                         diff=round(r1 - r0, 3), diff_ci=[round(r1 - r0 - 1.96 * se, 3), round(r1 - r0 + 1.96 * se, 3)], chi2=round(chi2, 2), p_value=float(f"{p:.2g}"))

# E. logistic regression: what drives lateness?
X = pd.DataFrame({
    "Vendor's recent OTIF below 80%": (d.vendor_recent_otif < 0.8).astype(int),
    "Monsoon": d.monsoon, "Distance over 50 km": (d.distance_km > 50).astype(int),
    "Ordered under 24 h before need": d.short_notice, "Ready-mix concrete": (d.material_id == "M4").astype(int)})
m = sm.Logit(d.late, sm.add_constant(X)).fit(disp=0)
orr = pd.DataFrame({"or": np.exp(m.params), "lo": np.exp(m.conf_int()[0]), "hi": np.exp(m.conf_int()[1]), "p": m.pvalues}).drop("const").round(3)
S["logit"] = dict(n=int(m.nobs), pseudo_r2=round(m.prsquared, 3), odds_ratios=orr.reset_index().rename(columns={"index": "factor"}).to_dict("records"))

# F. stage-2 alerts (at dispatch): threshold sweep
def pr(flag, y):
    tp = int(((flag == 1) & (y == 1)).sum()); fp = int(((flag == 1) & (y == 0)).sum()); fn = int(((flag == 0) & (y == 1)).sum())
    return dict(alerts=tp + fp, tp=tp, fp=fp, fn=fn, precision=round(tp / max(tp + fp, 1), 3), recall=round(tp / max(tp + fn, 1), 3))
sweep = []
for t in range(20, 95, 5):
    r = pr((d.risk_score >= t).astype(int), d.late); r["threshold"] = t; r["alerts_per_week"] = round(r["alerts"] / 25, 1); sweep.append(r)
S["alert_sweep"] = sweep
S["alert_at_50"] = pr(d.alert, d.late) | dict(lead_median_h=round(d[d.alert == 1].alert_lead_hours.median(), 1),
    lead_p25_h=round(d[d.alert == 1].alert_lead_hours.quantile(.25), 1), lead_p75_h=round(d[d.alert == 1].alert_lead_hours.quantile(.75), 1))
# late orders whose dispatch was on time -> invisible to a dispatch-based alert
S["late_with_ontime_dispatch_share"] = round(((d.late == 1) & (d.dispatch_late == 0)).sum() / d.late.sum(), 3)

# G. stage-1 watchlist at ORDER time (no dispatch info yet)
d["s1"] = d.pts_vendor_recent_otif_below_80 + d.pts_distance_over_50km + d.pts_ordered_under_24h + d.pts_monsoon
d["watch"] = (d.s1 >= 25).astype(int)
lead1 = (d.promised_ts - d.order_ts).dt.total_seconds() / 3600
S["watchlist_at_order"] = pr(d.watch, d.late) | dict(threshold=25, lead_median_h=round(lead1[d.watch == 1].median(), 1),
                                                     base_late_rate=round(d.late.mean(), 3))

# H. funnel (cohort: enquiries 6 Apr - 12 Jul so every later stage has time to happen)
ce = E[E.enquiry_date <= "2026-07-12"]
co = O[O.enquiry_id.isin(ce.enquiry_id)].copy()
cod = co[co.cancelled == 0]
paid60 = ((cod.paid_ts - cod.delivered_ts).dt.days <= 60) & cod.paid_ts.notna()
def repeat30(rows):
    out = []
    for _, r in rows.iterrows():
        nxt = O[(O.customer_id == r.customer_id) & (O.order_ts > r.delivered_ts) & (O.order_ts <= r.delivered_ts + pd.Timedelta(days=30))]
        out.append(int(len(nxt) > 0))
    return np.array(out)
rep = repeat30(cod)
funnel = [("Enquiries", len(ce)), ("Quoted", int(ce.quoted.sum())), ("Ordered", int(ce.ordered.sum())),
          ("Dispatched", len(cod)), ("Delivered on time & in full", int(cod.otif.sum())),
          ("Paid within 60 days", int(paid60.sum())), ("Re-ordered within 30 days", int(rep.sum()))]
S["funnel"] = [dict(stage=a, n=b) for a, b in funnel]
S["funnel_cohort"] = "Enquiries from 6 Apr to 12 Jul 2026"

# I. repeat after good vs bad delivery (all deliveries with a full 30-day window)
dd = d[d.delivered_ts <= END - pd.Timedelta(days=30)].copy()
dd["rep"] = repeat30(dd)
good, bad = dd[dd.otif == 1].rep, dd[dd.otif == 0].rep
z, pz = proportions_ztest([good.sum(), bad.sum()], [len(good), len(bad)])
S["repeat"] = dict(after_otif=round(good.mean(), 3), after_failure=round(bad.mean(), 3), n_otif=len(good), n_failure=len(bad), z=round(z, 2), p_value=float(f"{pz:.2g}"))

# J. A/B test sizing for the alert feature
base = round(d.on_time.mean(), 3)
for mde in [0.05, 0.08]:
    es = proportion_effectsize(min(base + mde, .999), base)
    n = NormalIndPower().solve_power(es, alpha=0.05, power=0.8, ratio=1)
    S.setdefault("ab_sizing", []).append(dict(baseline=base, mde=mde, n_per_arm=int(np.ceil(n)), weeks_at_current_volume=round(2 * np.ceil(n) / (len(d) / 25), 1)))

# materials
S["by_material"] = d.groupby("material").agg(n=("otif", "size"), otif=("otif", "mean"), late=("late", "mean")).round(3).reset_index().to_dict("records")
json.dump(S, open(f"{D}/stats_summary.json", "w"), indent=1, default=str)
print(json.dumps({k: S[k] for k in ["headline","pchart","monsoon_test","alert_at_50","late_with_ontime_dispatch_share","watchlist_at_order","funnel","repeat","ab_sizing"]}, indent=1, default=str))
print(orr); print(g[["vendor_id","n","otif","ci_lo","ci_hi","otif_shrunk"]])
print(pd.DataFrame(sweep)[["threshold","alerts_per_week","precision","recall"]])
