# SiteSupply: 24-hour build plan with Claude Code or OpenCode

1. Unzip this folder.
2. Run `git init`.
3. Open the folder in Claude Code or OpenCode. Claude Code reads `CLAUDE.md` automatically; OpenCode reads `AGENTS.md`. They are the same file.
4. Paste the prompts below **one session at a time**, and check the result in the browser before moving on.

## Session 1: setup and data layer (about 1.5 h)
> Read CLAUDE.md and docs/explainer.md. Scaffold the Vite + React + TS + Tailwind app with HashRouter, the design tokens (light and dark), the layout (top nav with Sample-data pill, footer) and empty pages for every route in the site map. Set up sql.js loading public/data/sitesupply.sqlite in a DB context with a useQuery(sql) hook. Then write src/lib/stats.ts and Vitest tests that reproduce data/stats_summary.json as described. Run npm test and fix until green. Commit.

## Session 2: product demo (about 3 h)
> Build the Demo pages: Orders list in a phone frame with filters and the Replay-time slider, Order detail with timeline and vendor last-10 dots, and the Alert screen with plain-English reasons from the pts_* columns and the backup-vendor suggestion. Follow the status logic in CLAUDE.md exactly. Make it look polished on 390px and inside the phone frame on desktop. Commit.

## Session 3: vendors and dashboard (about 3 h)
> Build the Vendors scorecard (sortable table + Wilson range and shrunk dot chart) and the Dashboard (KPI tiles, weekly OTIF p-chart with monsoon shading, funnel, material, monsoon vs dry, delay histogram). Every chart gets a Show SQL drawer that runs the query live with sql.js and shows the result table, plus a table-view toggle. Use the SQL in docs/metrics.md. Commit.

## Session 4: insights and stats lab (about 3 h)
> Build the Insights page (8 cards from section 7 of the explainer: chart, what we see, what it means, decision) and the Stats Lab (threshold slider with confusion matrix, two-stage warning comparison, A/B sample-size calculator, shrinkage playground, odds-ratio chart, "which test and why" cards). All numbers come from the DB or stats_summary.json. Commit.

## Session 5: docs, home and method (about 2.5 h)
> Write the docs/*.md files listed in CLAUDE.md from the explainer, render them on the Docs page with tabs, build the Home page (hero, phone mock of alert, KPI tiles, how it works, ready-mix story, insight teasers) and the Method page. Commit.

## Session 6: polish, test, deploy (about 2 h)
> Run a full review at 390px and 1440px: spacing, contrast, keyboard focus, empty and loading states, dark mode. Run Lighthouse and fix accessibility issues to 90+. Write the README as described in CLAUDE.md with screenshots. Run npm run build and npm test. Then help me deploy to Vercel.

## Before you put it on the resume
- Open the live link on your phone and click through every page.
- Read `docs/prd.md` and the Insights page out loud, and put anything that doesn't sound like you into your own words.
- Make sure the "Sample data" pill is visible.
- Add the live link to Resume B and Superset.

## Suggested resume bullets once it is live
**SiteSupply – Delivery-Delay Early Warning for Construction Orders | React, TypeScript, SQL, Statistics | [live link]**

- Wrote a PRD with 8 user stories, success metrics (OTIF, warning lead time, alert precision) and guardrails, and prioritised 6 features with RICE.
- Built a mobile-first prototype with explainable delay-risk alerts, a vendor scorecard and an ops dashboard where every metric shows its live SQL.
- On 1,100+ sample orders, used control charts, Wilson intervals with shrinkage, logistic regression and power analysis to set the alert threshold and roadmap.

When you talk about it, always say "sample data". If you also talk to real site engineers, add a bullet with the real count.
