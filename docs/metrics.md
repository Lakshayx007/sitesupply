# Metrics and the SQL behind them

All queries run on `public/data/sitesupply.sqlite` (SQLite, sample data). The results in brackets were checked against `data/stats_summary.json`.

## OTIF, on-time and in-full rates
*OTIF = orders delivered on time and in full ÷ delivered orders.* Cancelled orders are excluded.
```sql
SELECT ROUND(AVG(otif),3) AS otif, ROUND(AVG(on_time),3) AS on_time, ROUND(AVG(in_full),3) AS in_full, COUNT(*) AS delivered
FROM orders WHERE cancelled = 0;            -- 0.700 | 0.751 | 0.932 | 1138
```

## Weekly OTIF (for the control chart)
Week 1 starts Monday 6 April 2026, and weeks are assigned by promised date. The control limits are p̄ ± 3·sqrt(p̄(1−p̄)/n), with p̄ = 0.700.
```sql
SELECT CAST((julianday(substr(promised_ts,1,10)) - julianday('2026-04-06')) / 7 AS INT) + 1 AS week,
       COUNT(*) AS n, ROUND(AVG(otif),3) AS otif
FROM orders WHERE cancelled = 0 GROUP BY week ORDER BY week;   -- week 1: 29 orders, 0.759
```

## Vendor scorecard (raw)
The Wilson range and the shrunk value are computed in TypeScript from `n` and `s`.
```sql
SELECT o.vendor_id, v.vendor_name, COUNT(*) AS n, SUM(o.otif) AS s, ROUND(AVG(o.otif),3) AS otif,
       ROUND(AVG(CASE WHEN o.delay_hours > 0 THEN o.delay_hours END),1) AS avg_delay_h, v.price_index
FROM orders o JOIN vendors v USING (vendor_id)
WHERE o.cancelled = 0 GROUP BY o.vendor_id ORDER BY otif;      -- VK 180 orders 0.567, VG 205 orders 0.571
```

## Monsoon vs dry season
```sql
SELECT CASE monsoon WHEN 1 THEN 'Monsoon (Jun-Sep)' ELSE 'Dry (Apr-May)' END AS season,
       COUNT(*) AS n, ROUND(AVG(1 - on_time),3) AS late_rate, ROUND(AVG(otif),3) AS otif
FROM orders WHERE cancelled = 0 GROUP BY monsoon;               -- late 0.297 vs 0.165
```

## Alert precision and recall at a threshold
Replace `50` with the chosen threshold.

Current rule (since 19 Oct 2026): a score of 50+ **and** the truck late leaving.
```sql
SELECT SUM(risk_score >= 50 AND pts_dispatch_late > 0) AS alerts,
       ROUND(1.0 * SUM(risk_score >= 50 AND pts_dispatch_late > 0 AND on_time = 0) / SUM(risk_score >= 50 AND pts_dispatch_late > 0), 3) AS precision,
       ROUND(1.0 * SUM(risk_score >= 50 AND pts_dispatch_late > 0 AND on_time = 0) / SUM(on_time = 0), 3) AS recall,
       ROUND(SUM(risk_score >= 50 AND pts_dispatch_late > 0) / 25.0, 1) AS alerts_per_week
FROM orders WHERE cancelled = 0;                                 -- 290 | 0.748 | 0.767 | 11.6
```

Score-alone rule (the original analysis; the `alert` column):
```sql
SELECT SUM(risk_score >= 50) AS alerts,
       ROUND(1.0 * SUM(risk_score >= 50 AND on_time = 0) / SUM(risk_score >= 50), 3) AS precision,
       ROUND(1.0 * SUM(risk_score >= 50 AND on_time = 0) / SUM(on_time = 0), 3)      AS recall,
       ROUND(SUM(risk_score >= 50) / 25.0, 1) AS alerts_per_week
FROM orders WHERE cancelled = 0;                                 -- 423 | 0.556 | 0.830 | 16.9
```

## Warning lead time (hours)
The median is computed in TypeScript from these rows. Expected: median 2.3 h with the current rule, 2.5 h with the score-alone rule (`alert = 1`).
```sql
SELECT alert_lead_hours FROM orders WHERE cancelled = 0 AND risk_score >= 50 AND pts_dispatch_late > 0;
```

## Funnel (cohort: enquiries from 6 Apr to 12 Jul 2026)
```sql
SELECT COUNT(*) AS enquiries, SUM(quoted) AS quoted, SUM(ordered) AS ordered
FROM enquiries WHERE enquiry_date <= '2026-07-12';               -- 1895 | 1589 | 723

SELECT COUNT(*) AS dispatched, SUM(o.otif) AS delivered_otif,
       SUM(o.paid_ts IS NOT NULL AND CAST(julianday(o.paid_ts) - julianday(o.delivered_ts) AS INT) <= 60) AS paid_60d
FROM orders o JOIN enquiries e USING (enquiry_id)
WHERE e.enquiry_date <= '2026-07-12' AND o.cancelled = 0;        -- 711 | 521 | 465
```

## Repeat within 30 days of a delivery
The overall repeat rate is 348 of the funnel cohort. The split after good and bad deliveries uses deliveries made on or before 29 Aug 2026, so each one has a full 30-day window.
```sql
SELECT o.otif, COUNT(*) AS deliveries,
       ROUND(AVG(EXISTS (SELECT 1 FROM orders n WHERE n.customer_id = o.customer_id
                         AND n.order_ts > o.delivered_ts
                         AND julianday(n.order_ts) <= julianday(o.delivered_ts) + 30)), 3) AS repeat_30d
FROM orders o
WHERE o.cancelled = 0 AND o.delivered_ts <= '2026-08-29 00:00'
GROUP BY o.otif;                                                 -- 1: 0.513 (694) | 0: 0.396 (278)
```

## OTIF by material
```sql
SELECT material, COUNT(*) AS n, ROUND(AVG(otif),3) AS otif, ROUND(AVG(1 - on_time),3) AS late_rate
FROM orders WHERE cancelled = 0 GROUP BY material ORDER BY otif;
```

## Metric definitions
| Metric | Definition | Type |
|---|---|---|
| OTIF rate | delivered on time and in full ÷ delivered | North-star input |
| Monthly OTIF order value | value of orders delivered OTIF in the month | North star |
| Warning lead time | promised time − alert time, median hours | Feature |
| Alert precision | alerts on orders that were late ÷ all alerts | Feature |
| Alert recall | late orders that got an alert ÷ all late orders | Feature |
| % alerts acted on | alerts where the user tapped an action ÷ alerts (needs product logging) | Adoption |
| Alerts per user per week | alert volume per site engineer | Guardrail (fatigue) |
| Vendor acceptance rate | orders accepted by vendors ÷ orders offered | Guardrail |
| Cost per order | logistics + ops cost per order | Guardrail |
