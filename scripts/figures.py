import json, pandas as pd, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
S = json.load(open("data/stats_summary.json"))
BLUE, ORANGE, GREY, INK, LIGHT, GREEN, RED = "#2F6FDE", "#E8833A", "#9AA3AF", "#1F2937", "#E5E7EB", "#2E9E6A", "#D64545"
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.edgecolor": GREY, "axes.labelcolor": INK, "xtick.color": INK, "ytick.color": INK, "axes.titleweight": "bold",
                     "axes.titlesize": 13, "axes.titlelocation": "left", "figure.dpi": 160})
def save(f, n): f.tight_layout(); f.savefig(f"figs/{n}.png", bbox_inches="tight", facecolor="white"); plt.close(f)
NOTE = "Sample data (synthetic, generated with seed 42)"

# 1. order journey with warning points
f, ax = plt.subplots(figsize=(10, 3.2)); ax.axis("off"); ax.set_xlim(0, 10); ax.set_ylim(0, 3.2)
steps = ["Order placed", "Vendor\nconfirms", "Dispatched\nfrom plant", "In transit", "Delivered\nat site"]
xs = np.linspace(0.8, 9.2, 5)
ax.plot([xs[0], xs[-1]], [1.6, 1.6], color=LIGHT, lw=6, zorder=1)
for x, s in zip(xs, steps):
    ax.scatter(x, 1.6, s=380, color=BLUE, zorder=2, edgecolor="white", lw=2); ax.text(x, 0.75, s, ha="center", va="center", fontsize=10.5, color=INK)
ax.annotate("Early watch\n(days ahead): risky vendor,\nlong route, monsoon, rush order", xy=(xs[0], 1.85), xytext=(2.2, 2.85), ha="center", fontsize=9.5, color=ORANGE,
            arrowprops=dict(arrowstyle="->", color=ORANGE))
ax.annotate("Delay alert\n(hours ahead):\ntruck has not left on time", xy=(xs[2], 1.85), xytext=(5.6, 2.85), ha="center", fontsize=9.5, color=RED,
            arrowprops=dict(arrowstyle="->", color=RED))
ax.text(9.2, 2.6, "Goal: the site engineer\nhears about a delay\nbefore the crew waits", ha="center", fontsize=9.5, color=INK, style="italic")
save(f, "f1_journey")

# 2. score points
f, ax = plt.subplots(figsize=(8, 3.3))
items = [("Truck dispatch is more than 1 h late", 40), ("Vendor's last 10 orders: under 80% OTIF", 25), ("Site is more than 50 km away", 15),
         ("Ordered less than 24 h before need", 10), ("Monsoon month (June to September)", 10)]
ax.barh([i[0] for i in items][::-1], [i[1] for i in items][::-1], color=BLUE, height=0.55)
for i, (_, v) in enumerate(items[::-1]): ax.text(v + 0.8, i, f"+{v}", va="center", color=INK, fontweight="bold")
ax.set_xlim(0, 48); ax.set_xlabel("Points added to the delay-risk score (0 to 100)")
ax.set_title("The delay-risk score: simple rules anyone can check")
ax.text(47, 0, "50+ points\n= \"At risk\" alert", color=RED, fontsize=10.5, fontweight="bold", ha="right", va="center")
save(f, "f2_score")

# 3. p-chart
w = pd.read_csv("data/weekly_otif.csv")
f, ax = plt.subplots(figsize=(9, 3.6))
ax.fill_between(w.week, w.lcl * 100, w.ucl * 100, color=LIGHT, step="mid", label="Normal range (3-sigma control limits)")
ax.axhline(S["pchart"]["pbar"] * 100, color=GREY, lw=1, ls="--")
ax.plot(w.week, w.otif * 100, color=BLUE, lw=2, marker="o", ms=4, label="Weekly OTIF")
o = w[w.out == 1]
if len(o): ax.scatter(o.week, o.otif * 100, s=90, facecolor="none", edgecolor=RED, lw=2, zorder=3, label="Outside normal range")
ax.axvspan(8.5, 25.5, color=ORANGE, alpha=0.07); ax.text(16.5, 101, "Monsoon weeks (June onwards)", color=ORANGE, ha="center", fontsize=9.5)
ax.set_ylim(40, 105); ax.set_xlabel("Week (week 1 starts 6 April 2026)"); ax.set_ylabel("OTIF %")
ax.set_title("Weekly on-time-in-full rate with a control chart", pad=28); ax.legend(loc="upper left", bbox_to_anchor=(0, 1.13), fontsize=8.5, frameon=False, ncol=3)
ax.text(25, 41, NOTE, fontsize=8, color=GREY, ha="right"); save(f, "f3_pchart")

# 4. vendors
v = pd.read_csv("data/vendor_stats.csv").sort_values("otif_shrunk")
f, ax = plt.subplots(figsize=(8.5, 4.6)); y = np.arange(len(v))
ax.hlines(y, v.ci_lo * 100, v.ci_hi * 100, color=GREY, lw=2.5, label="95% confidence range (Wilson)")
ax.scatter(v.otif * 100, y, color=BLUE, s=45, zorder=3, label="Raw OTIF")
ax.scatter(v.otif_shrunk * 100, y, color=ORANGE, marker="D", s=30, zorder=4, label="Adjusted OTIF (shrunk toward average)")
ax.set_yticks(y); ax.set_yticklabels([f"{a.replace('V','Vendor ')}  (n={n})" for a, n in zip(v.vendor_id, v.n)])
ax.axvline(S["pchart"]["pbar"] * 100, color=GREY, ls="--", lw=1); ax.set_xlabel("OTIF %")
ax.set_title("Vendor reliability: the number and how sure we are"); ax.legend(fontsize=8.5, frameon=False, loc="lower right")
save(f, "f4_vendors")

# 5. threshold trade-off
sw = pd.DataFrame(S["alert_sweep"])
f, ax = plt.subplots(figsize=(8.5, 3.6))
ax.plot(sw.threshold, sw.precision * 100, color=BLUE, lw=2, marker="o", ms=4, label="Precision: alerts that were right")
ax.plot(sw.threshold, sw.recall * 100, color=ORANGE, lw=2, marker="s", ms=4, label="Recall: late orders that got an alert")
ax.axvline(50, color=RED, ls="--", lw=1); ax.text(51, 22, "chosen\nthreshold 50", color=RED, fontsize=9)
ax.set_xlabel("Alert threshold (score)"); ax.set_ylabel("%"); ax.set_ylim(0, 100)
ax.set_title("Choosing the alert threshold is a product decision"); ax.legend(frameon=False, fontsize=9, loc="lower left")
ax.text(90, 3, NOTE, fontsize=8, color=GREY, ha="right"); save(f, "f5_threshold")

# 6. funnel
fn = pd.DataFrame(S["funnel"])
f, ax = plt.subplots(figsize=(8.5, 4)); y = np.arange(len(fn))[::-1]
ax.barh(y, fn.n, color=[BLUE] * 3 + [ORANGE] * 4, height=0.6)
for yy, (st, n) in zip(y, zip(fn.stage, fn.n)):
    ax.text(n + 20, yy, f"{n:,}  ({n / fn.n[0] * 100:.0f}%)", va="center", fontsize=9.5)
ax.set_yticks(y); ax.set_yticklabels(fn.stage); ax.set_xlim(0, fn.n.max() * 1.3); ax.set_xticks([])
ax.spines["bottom"].set_visible(False)
ax.set_title("The order funnel: from enquiry to repeat order")
ax.text(0, -1.1, NOTE + "; blue = selling, orange = delivering and keeping", fontsize=8, color=GREY, transform=ax.get_yaxis_transform())
save(f, "f6_funnel")

# 7. odds ratios
lo = pd.DataFrame(S["logit"]["odds_ratios"]).sort_values("or")
f, ax = plt.subplots(figsize=(8.5, 3.4)); y = np.arange(len(lo))
ax.hlines(y, lo.lo, lo.hi, color=GREY, lw=2.5); ax.scatter(lo["or"], y, color=BLUE, s=55, zorder=3)
ax.axvline(1, color=INK, lw=1); ax.set_ylim(-0.5, len(lo) - 0.3); ax.set_yticks(y); ax.set_yticklabels(lo.factor)
for yy, r in zip(y, lo["or"]): ax.text(r, yy + 0.25, f"{r:.1f}x", ha="center", fontsize=9)
ax.set_xlabel("Odds ratio (1 = no effect; 2 = twice the odds of being late)")
ax.set_title("What makes an order late? (logistic regression)"); save(f, "f7_drivers")

# 8. delay distribution
O = pd.read_csv("data/orders.csv"); lt = O[(O.cancelled == 0) & (O.on_time == 0)].delay_hours
f, ax = plt.subplots(figsize=(8.5, 3.3))
ax.hist(lt.clip(upper=60), bins=30, color=BLUE, edgecolor="white")
h = S["headline"]
top = ax.get_ylim()[1]
for val, lab, c, yy in [(h["delay_median_h"], "median", INK, 0.62), (h["delay_mean_h"], "average", ORANGE, 0.88), (h["delay_p90_h"], "90th percentile", RED, 0.88)]:
    ax.axvline(val, color=c, ls="--", lw=1.5); ax.text(val + 0.6, top * yy, f"{lab}\n{val} h", color=c, fontsize=9, backgroundcolor="white")
ax.set_xlabel("Hours late (late orders only; values above 60 shown at 60)"); ax.set_ylabel("Orders")
ax.set_title("How late is late? A few very late orders pull the average up"); save(f, "f8_delay")

# 9. repeat
r = S["repeat"]
f, ax = plt.subplots(figsize=(6.5, 3.2))
ax.bar(["After an on-time,\nin-full delivery", "After a late or\nshort delivery"], [r["after_otif"] * 100, r["after_failure"] * 100], color=[GREEN, RED], width=0.5)
for i, val in enumerate([r["after_otif"], r["after_failure"]]): ax.text(i, val * 100 + 1.5, f"{val * 100:.0f}%", ha="center", fontweight="bold")
ax.set_ylabel("% who re-order within 30 days"); ax.set_ylim(0, 65)
ax.set_title("Reliability drives repeat orders"); ax.set_xlabel(NOTE + "; pattern planted on purpose", fontsize=8, color=GREY, labelpad=8)
save(f, "f9_repeat")
print("ok")
