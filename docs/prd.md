# PRD: SiteSupply delivery-delay early warning

**Author:** Lakshay Malik · **Status:** Draft for the MVP · **Data:** all numbers below come from the project's sample data (synthetic, seed 42), not from a real company.

## 1. Problem
Site teams learn that a construction-material delivery is late only when the truck doesn't arrive. By then the crew is waiting, the pump and crane are on the clock, and for ready-mix concrete a late truck can mean a wasted load (a common rule of thumb from IS 4926 is that transit should stay within about 2 hours of mixing).

The signs were usually visible earlier: the truck hadn't left on time, the vendor had been late on recent orders, the site was far away, it was monsoon season. Nobody put them together and told the site engineer in time.

## 2. Users
| User | Goal | Pain today |
|---|---|---|
| **Site engineer** (primary) | Keep the day's work running | Finds out about delays only when the truck doesn't come |
| Procurement manager | Buy at a fair price from vendors who deliver | Can't see which vendors are reliable; chooses on price |
| Vendor dispatcher | Load and send trucks on time | Gets angry calls after the fact; no early nudge |
| Operations / category manager | Keep OTIF high across many orders | Problems show up in monthly reports, too late to fix |

## 3. Goals and non-goals
**Goals**
- Warn the site team early enough to act on a likely late delivery.
- Explain every warning in plain words.
- Make vendor reliability visible next to price.

**Non-goals**
- Pricing and quoting.
- Payments.
- Running the vendor's own logistics or fleet.

## 4. Solution overview
1. **Risk score.** Each order gets points for warning signs: truck not out an hour after planned dispatch (+40), vendor on time and in full on under 80% of its last 10 orders (+25), route over 50 km (+15), ordered under 24 hours before need (+10), monsoon season (+10).
2. **Two warnings.** An early "watch" label when the order is placed (score of 25+ without the dispatch sign), and a delay alert at the dispatch check: score of 50+ **and** the truck late leaving the plant. Orders that reach 50 without a late truck stay on Watch. (On the sample data this rule cut false alarms from 188 to 73, with 75% of alerts right and 77% of late orders caught, against 56% and 83% for "score of 50+" alone. It was found on the same data, so it is the first thing to validate on real orders.)
3. **Alert.** Reasons as sentences, plus three actions: call the vendor, switch to the most reliable backup vendor for the same material, reschedule the work.
4. **Vendor scorecard.** Raw and adjusted OTIF with a 95% range.
5. **Operations dashboard.** Weekly OTIF on a control chart, funnel, materials, monsoon vs dry season.

Rules were chosen over a black-box model because a site engineer has to trust an alert before acting on it. A logistic regression was used only to check that the rules point the right way.

## 5. User stories
See [user_stories.md](user_stories.md) for all eight stories with Given / When / Then acceptance criteria:
1. Delay alert for the site engineer.
2. Reliability next to price for procurement.
3. Weekly OTIF on a control chart for operations.
4. Early nudge for the vendor dispatcher.
5. Monthly vendor scorecard for operations.
6. Switch to a backup vendor.
7. Reschedule the work.
8. Alert settings.

## 6. Success metrics and guardrails
**North star:** monthly value of orders delivered on time and in full.

| Metric | Type | Sample-data baseline |
|---|---|---|
| OTIF rate | Outcome | 70.0% |
| Warning lead time (median) | Feature | 2.3 h at the dispatch check (2.5 h with the score-alone rule) |
| Alert precision | Feature | 74.8% with the current rule (55.6% with the score-alone rule) |
| Alert recall | Feature | 76.7% with the current rule (83.0% with the score-alone rule) |
| Alerts per week | Guardrail | 11.6 with the current rule (16.9 with the score-alone rule) |
| % of alerts acted on | Adoption | Needs product logging |

The current rule is a score of 50+ **and** the truck late leaving; the score-alone rule is a score of 50+.

**Guardrails** (must not get worse): vendor acceptance rate, cost per order, alerts per user per week (alert fatigue).

## 7. Risks
- **Alert fatigue.** With "score of 50+" alone there are about 17 alerts a week and 44% are false alarms; requiring a late truck brings that to about 12 a week and 25%. Mitigation: that rule, reasons on every alert, tracking % of alerts acted on, and raising the threshold if it falls.
- **Vendor push-back.** Vendors may object to public scores. Mitigation: share each vendor's own scorecard with them first, show the confidence range, adjust small samples toward the average.
- **Bad timestamps.** The dispatch sign depends on an accurate "truck left" time. Mitigation: one-tap dispatch confirmation for vendors, GPS in v2, flag orders with missing timestamps instead of guessing.
- **Delays the dispatch check can't see.** About 20% of late orders leave on time and are delayed on the road. Mitigation: live GPS tracking in v2.

## 8. Phased rollout
1. **Pilot:** a few sites, dispatch alerts only, in-app.
2. **Staggered rollout:** turn the feature on site by site and compare before and after. A classic A/B test needs about 1,089 orders per group to detect a 5-point gain from 75% on time, which is about 48 weeks at 45 orders a week.
3. **Scale:** vendor scorecards for procurement, early watch label, WhatsApp alerts.

## 9. Open questions
- Does a WhatsApp alert get acted on more often than an in-app alert?
- What does a missed delay really cost in rupees, by material? Real cost data would sharpen the threshold choice.
- Will vendors confirm dispatch times reliably without GPS?
- Should the threshold differ by material (for example, lower for ready-mix concrete)?
- What do site engineers actually do today in the first 15 minutes after a truck is late? (See the research plan.)
