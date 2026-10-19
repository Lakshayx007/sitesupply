# Metrics tree

```
North star: monthly value of orders delivered on time and in full
│
├── Dispatch punctuality
│     share of trucks leaving within an hour of planned dispatch
│
├── Vendor mix
│     share of orders going to vendors with adjusted OTIF of 65% or more
│
├── Alert quality
│     ├── precision: alerts on orders that were late ÷ all alerts
│     ├── recall: late orders that got an alert ÷ all late orders
│     └── lead time: promised time − alert time (median hours)
│
└── Adoption
      % of alerts acted on (call, switch vendor, reschedule)

Guardrails (must not get worse)
├── Cost per order
├── Vendor acceptance rate
└── Alerts per user per week (alert fatigue)
```

## Why this north star
Reliability drives repeat orders. On the sample data, 51% of customers ordered again within 30 days after an on-time, in-full delivery, against 40% after a late or short one (p ≈ 0.001). Growth only counts if it is reliable growth, so the north star weights order value by whether it arrived on time and in full.

## Definitions
| Metric | Definition | Type |
|---|---|---|
| OTIF rate | delivered on time and in full ÷ delivered | North-star input |
| Monthly OTIF order value | value of orders delivered OTIF in the month | North star |
| Warning lead time | promised time − alert time, median hours | Feature |
| Alert precision | alerts on orders that were late ÷ all alerts | Feature |
| Alert recall | late orders that got an alert ÷ all late orders | Feature |
| % alerts acted on | alerts where the user tapped an action ÷ alerts | Adoption |
| Alerts per user per week | alert volume per site engineer | Guardrail |
| Vendor acceptance rate | orders accepted by vendors ÷ orders offered | Guardrail |
| Cost per order | logistics + ops cost per order | Guardrail |
