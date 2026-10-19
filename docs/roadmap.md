# Roadmap

The roadmap follows one finding from the sample data: **dispatch alerts are accurate but give only about 2.5 hours of warning, and about 20% of late orders leave the plant on time and get stuck on the road.** So v1 ships what is accurate now, and v2 adds the signal the dispatch check can't see.

## MVP (now)
- **Delay alert at dispatch:** risk score with reasons, three actions.
- **Vendor scorecard:** raw and adjusted OTIF with a 95% range.
- **Operations dashboard:** weekly OTIF control chart, funnel, materials, season.
- **Measure:** OTIF, lead time, precision, recall, % of alerts acted on.

## v2 (next)
- **Live GPS tracking** to catch delays on the road.
- **Backup-vendor suggestion** with one-tap second order.
- **Early watch label** at order time, shown softly ("keep an eye on this"), not as a loud alert.
- **Vendor dispatch confirmations** in one tap, to fix missing timestamps.
- **WhatsApp alerts**, if research shows they get acted on more.

## v3 (later)
- **AI assistant** that reads a project's material schedule and predicts shortages before orders are placed.
- **Threshold by material**, for example more sensitive for ready-mix concrete.
- **Monsoon playbook** built in: bigger buffers for promised slots, earlier dispatch, backups lined up before June.

## How we'll know it works
At small volume a classic A/B test is too slow (about 48 weeks to detect a 5-point gain at 45 orders a week), so the rollout is staggered: site by site, comparing before and after, with the guardrails watched throughout.
