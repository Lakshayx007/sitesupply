# SiteSupply: project brief for the coding agent

> ## Direction update, 19 Oct 2026 (overrides the brief below where they conflict)
> Lakshay reviewed Session 1 and changed direction. Follow this section first.
> - **Product, not portfolio.** The public site presents SiteSupply as a product. No "Sample data" pills and no "PM workspace" labels in the UI. The footer carries one plain disclosure: a concept product whose console runs on a simulated order history. Never present the numbers as a real customer's results; the "What it catches" stat strip says it was measured on a 25-week simulation. The sample-data story is for interviews, the README and `docs/`.
> - **Design system:** dark, product-first, adapted from the Linear DESIGN.md in VoltAgent/awesome-claude-design (MIT). Tokens and rules live in `docs/DESIGN.md` and `src/styles/index.css`. No light mode.
> - **Information architecture:** `/` is the product landing page (hero is the live board replaying a real morning). The product is the **console** at `/console` (live board, `/console/order/:id`, `/console/alerts`, `/console/site` phone view, `/console/ask`). Old `/demo` links redirect. The status logic below is implemented in `src/lib/live.ts` with tests.
> - **AI is allowed** (supersedes "no backend"): "Ask SiteSupply" turns questions into read-only SQL run in the browser and writes a short answer; alerts can draft a message to the vendor. In production it calls Groq through the Vercel function `api/ai.js` (key in `GROQ_API_KEY`, never committed; see `.env.example`). In a Claude artifact preview it uses the viewer's Claude. With neither, preset questions still run offline.
> - Built in the console: `/console/vendors` (sortable scorecard, Wilson range and adjusted OTIF chart, "Why adjusted?", price vs reliability) and `/console/analytics` (KPI tiles, weekly OTIF p-chart with monsoon shading, funnel, delay histogram, OTIF by material, monsoon vs dry). Every chart has a Chart/Table toggle and a "Show SQL" drawer that runs the query live.
> - Not yet rebuilt in the new style: insights, stats lab, docs and method pages. Build them as product pages before linking them anywhere.

You are building **SiteSupply**, the flagship product-management portfolio project of Lakshay Malik (GitHub: Lakshayx007).
SiteSupply is a delivery-delay early-warning product for construction material orders (cement, TMT steel, ready-mix concrete,
aggregate, M-sand). The website has two halves:

- **Product demo**: what a site engineer would use on a phone.
- **PM workspace**: dashboard, insights, stats lab, PRD and documents.

The full story, every insight and every statistic is in `docs/explainer.md`. **Read it first. It is the source of truth for wording and numbers.**

## Non-negotiable rules
1. **All data is sample data.** It is synthetic, from `scripts/make_sample_data.py` with seed 42.
   - Show a small "Sample data" pill in the header of every data page.
   - Say it again in the footer and on the Method page.
   - Never present it as real company data.
2. **Use the data that is already in this repo.**
   - Use `data/*.csv`, `data/stats_summary.json` and `public/data/sitesupply.sqlite`.
   - Do not regenerate data with different settings.
   - Do not invent numbers. Every number on screen must come from a query or from `stats_summary.json`.
3. **Never invent user research.** `docs/user_research.md` stays a template with empty findings.
4. **No real company names, logos or branding** in the UI. Vendors are "Vendor A" to "Vendor L".
5. **No backend and no secrets.** It is a static site and everything runs in the browser. Nothing goes in `.env`.
6. **Accessibility.**
   - Status is never shown by colour alone: always add an icon and a label.
   - Text contrast must be AA.
   - The keyboard must reach everything.
   - Every chart has a table view toggle.

## Tech stack
- **App:** Vite + React 18 + TypeScript + Tailwind CSS, with React Router using `HashRouter` so it works on static hosting.
- **Charts:** Apache ECharts via `echarts-for-react`.
  - Thin lines (2px).
  - Rounded bar ends.
  - Gridlines are light grey.
  - Hover tooltips on every chart.
  - **Never use a dual y-axis.**
- **SQL in the browser:** `sql.js`. Copy `sql-wasm.wasm` into `public/`, then open `public/data/sitesupply.sqlite` at start-up and cache the DB in a React context.
- **Markdown:** `react-markdown` + `remark-gfm` to render the files in `docs/` on the Docs page.
- **Icons:** `lucide-react`.
- **Tests:** Vitest. Deploy to Vercel or Netlify.

## Design system
- **Feel:** clean, calm and industrial. Think of a modern logistics tool: lots of white space, crisp cards and one strong accent.
- **Fonts:** Inter for the UI, and JetBrains Mono for SQL and numbers in tables. Load both from Google Fonts.
- **Colour tokens.** Define them as CSS variables and support dark mode:

| Token | Hex | Used for |
|---|---|---|
| ink | `#0F172A` | main text |
| muted | `#64748B` | secondary text |
| surface | `#FFFFFF` | page and cards |
| subtle | `#F1F5F9` | panels |
| border | `#E2E8F0` | lines and card edges |
| primary (steel blue) | `#2F6FDE` | main data series, links, buttons |
| accent (safety orange) | `#E8833A` | second series, highlights |
| status good | `#2E9E6A` | with ✓ icon |
| status watch | `#C99A06` | with eye icon |
| status at risk | `#E8833A` | with ⚠ icon |
| status late | `#D64545` | with ⏱ icon |

  The four status colours are reserved for status and are never used for chart series.
- **Cards and controls.**
  - Cards: radius 16px, 1px border, very soft shadow.
  - KPI tiles: big number, small label, and a delta or note underneath.
  - Filters sit in one row above the charts.
- **Phone frame.** The product demo renders inside a phone frame (390×844) on desktop and full-screen on mobile.

## Site map (pages)
1. **Home (`/`).**
   - Hero: "Know about a late delivery before your crew does."
   - A one-line subtitle and two buttons: "Try the demo" and "See the PM work".
   - A phone mock-up showing the alert screen.
   - A row of 4 KPI tiles from the data:
     - OTIF 70.0%.
     - Late orders caught by alerts 83%.
     - Median warning 2.5 h.
     - Orders analysed 1,138.
   - A "How it works" section in 3 steps: watch every order, score the risk, alert with reasons and actions.
   - The ready-mix concrete story from section 1 of the explainer.
   - Three insight teasers.
   - A footer with the sample-data note and the GitHub link.
2. **Demo: Orders (`/demo`).** Phone frame.
   - Orders list for the demo customer. Pick the customer with the most orders and say so.
   - Each row shows material, quantity and unit, site, vendor, promised time, a status chip and a risk badge (0–100).
   - Filters: status, material.
   - Status logic. "Now" is set by the replay slider.
     - **Before `check_ts`** (truck not due out yet): the early score = `pts_vendor_recent_otif_below_80 + pts_distance_over_50km + pts_ordered_under_24h + pts_monsoon`. If it is ≥ 25 → Watch, otherwise On track.
     - **From `check_ts` until delivery:** the full `risk_score`. If it is ≥ 50 → At risk, otherwise On track.
     - **Delivered:** "Delivered" if OTIF; "Delivered late" or "Delivered short" otherwise.
   - Add a "Replay time" control. It is a slider over the 25 weeks that changes "now", so orders move from pending to delivered and alerts appear. This makes the demo feel live.
3. **Demo: Order detail (`/demo/order/:id`).**
   - A timeline: Ordered → Vendor confirmed → Dispatched (planned vs actual) → In transit → Delivered.
   - Promised vs actual arrival.
   - Distance.
   - The vendor's last 10 orders as ✓/✗ dots.
   - The risk score with **a breakdown of points in plain words**.
4. **Demo: Alert (`/demo/alert/:id`).**
   - A big warning card: "Likely late by several hours".
   - Reasons as sentences, built from the `pts_*` columns.
   - Three action buttons: Call vendor, Switch to backup vendor, Reschedule work. They only show a toast.
   - Backup vendor = the most reliable vendor that supplies the same material (by shrunk OTIF).
5. **Vendors (`/vendors`).**
   - Scorecard table: vendor, materials, orders, raw OTIF, 95% Wilson range, adjusted OTIF (shrunk), average delay and price index.
   - The table is sortable.
   - Below it, the dot-and-range chart, like `figs/f4_vendors.png`.
   - An explainer box: "Why adjusted?"
6. **Dashboard (`/dashboard`).**
   - KPI tiles: OTIF, on-time, in-full, median delay, 90th-percentile delay, alerts per week.
   - Weekly OTIF with p-chart control limits: a shaded band, the centre line, monsoon weeks shaded.
   - The funnel, as horizontal bars with step conversion.
   - OTIF by material.
   - Monsoon vs dry season.
   - Delay histogram with median, average and P90 lines.
   - **Every chart has "Show SQL"**: a drawer showing the SQL that is run live with sql.js, plus the result table.
7. **Insights (`/insights`).** The 8 insights from section 7 of the explainer, as cards. Each card has:
   - a title;
   - one chart;
   - "What we see", "What it means" and "Decision";
   - a "Sample data" tag.
8. **Stats Lab (`/stats-lab`).** Interactive and computed live in TypeScript.
   - **Threshold slider** (20–90). It updates:
     - the confusion matrix;
     - precision and recall;
     - alerts per week;
     - a sentence: "At threshold X you would send Y alerts a week; Z% would be right; you'd catch W% of late orders."
   - **Two-stage warning**: compare the early watch at order time with the dispatch alert. Show precision, recall and median lead time for each.
   - **A/B sample-size calculator.** Inputs: baseline (default 75.1%), minimum detectable effect, alpha and power, plus weekly volume. Output: orders per arm and weeks needed.
   - **Shrinkage playground.** Pick a vendor and drag the prior strength (0–100). Watch the adjusted OTIF move.
   - **Drivers.** The odds-ratio chart from `stats_summary.json` (logit), with a plain-English reading of each row.
   - **"Which test, and why"**: short cards for every method in section 8 of the explainer.
9. **Docs (`/docs`).** Tabs that render the markdown:
   - PRD;
   - user stories;
   - RICE;
   - metrics tree;
   - roadmap;
   - competitive scan;
   - user research plan;
   - metrics and SQL.
10. **Method (`/method`).**
    - How the data was generated.
    - The table of planted patterns.
    - Why planting patterns is useful.
    - Limits.
    - How to reproduce: `python scripts/make_sample_data.py && python scripts/analysis.py && python scripts/build_sqlite.py`.

## Statistics to implement in `src/lib/stats.ts` (with unit tests)
- `wilson(successes, n, z = 1.96)` returns `[lo, hi]`.
- `shrink(successes, n, priorMean, k)` returns `(s + priorMean * k) / (n + k)`.
- `percentile(values, p)`: linear interpolation, the same as pandas' default.
- `confusion(scores, late, threshold)` returns `{tp, fp, fn, tn, precision, recall}`.
- `sampleSizeTwoProportions(p1, p2, alpha, power)`: use Cohen's h and the normal approximation.
- `pchartLimits(pbar, n)` returns `[max(0, pbar - 3σ), min(1, pbar + 3σ)]`, where `σ = sqrt(pbar(1 - pbar)/n)`.
- **Tests must reproduce `data/stats_summary.json`:**
  - OTIF 0.700.
  - Precision at 50: 0.556. Recall at 50: 0.830.
  - Vendor L Wilson range 0.454–0.828.
  - Vendor L shrunk value 0.683 with k = 20.
  - About 1,089 per arm for 0.751 → 0.801.

  Each value must match within ±0.002. If a test fails, fix the code, not the expected value.

## Repo layout
```
data/            CSVs + stats_summary.json + vendor_stats.csv + weekly_otif.csv (given, do not edit)
public/data/     sitesupply.sqlite (given)
scripts/         make_sample_data.py, analysis.py, figures.py, build_sqlite.py (given)
figs/            static PNGs from analysis (given; for the README)
docs/            explainer.md (given), metrics.md (given), prd.md, user_stories.md, rice.md, metrics_tree.md,
                 roadmap.md, competitive_scan.md, user_research.md   <- create these from the explainer
src/             the app
```

## Docs to create (from `docs/explainer.md`, in plain English)
- **`prd.md`:**
  - problem;
  - users;
  - goals and non-goals;
  - the solution overview;
  - the 8 user stories with Given/When/Then;
  - success metrics and guardrails;
  - risks (alert fatigue, vendor push-back, bad timestamps);
  - phased rollout;
  - open questions.
- **`user_stories.md`:** all 8 stories. There are 3 in the explainer. Write 5 more covering vendor dispatcher, ops manager, backup vendor, reschedule and alert settings.
- **`rice.md`:** the RICE table, clearly marked as estimates.
- **`metrics_tree.md`:** the metrics tree.
- **`roadmap.md`:** the MVP, v2 and v3 roadmap.
- **`competitive_scan.md`:**
  - Compare *categories*: phone and WhatsApp, Excel trackers, generic procurement software, logistics GPS-tracking tools.
  - For each one, say what it does well, what it misses for a site engineer, and where SiteSupply fits.
  - No company names. No market-size numbers.
  - Leave an empty "Sources" section for Lakshay.
- **`user_research.md`:**
  - Goals.
  - Mom Test questions.
  - A table for 5 interviews: role, city, last bad delivery, cost, quote.
  - An empty "What I learned" section.

## README
1. One paragraph on the problem, the live link and a hero screenshot.
2. "What's inside" (the pages).
3. Key insights, 3 bullets, "on sample data".
4. "What's real vs sample".
5. Statistics used.
6. Run locally: `npm install && npm run dev`, and `npm test`.
7. Reproduce the data.
8. Docs links.
9. Author.

## Definition of done
- Every page above exists and works at 390px wide and at 1440px wide.
- Lighthouse accessibility is 90 or higher.
- `npm run build` passes, and `npm test` passes, matching `stats_summary.json`.
- Every chart has "Show SQL" (dashboard) or a stated source (`stats_summary.json`), plus a table view.
- The "Sample data" label is visible on every data page.
- It is deployed, and the README has screenshots.
- Commits are small and clear. Do not commit `node_modules` or any secrets.
