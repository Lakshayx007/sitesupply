# RICE prioritisation

> **These are my own estimates, not measured values.** That is normal for RICE: the point is to make the reasoning visible and comparable. Reach is orders affected per quarter, about 590 at the sample volume.

RICE score = Reach × Impact × Confidence ÷ Effort.

| Feature | Reach (orders / quarter) | Impact | Confidence | Effort (person-weeks) | RICE score |
|---|---|---|---|---|---|
| Delay alert at dispatch | 590 | 2 | 80% | 3 | **315** |
| Vendor reliability scorecard | 590 | 1 | 80% | 2 | **236** |
| Early watch at order time | 590 | 1 | 50% | 2 | **148** |
| Live GPS tracking | 590 | 2 | 70% | 10 | **83** |
| Photo proof of delivery (quantity disputes) | 590 | 0.5 | 80% | 3 | **79** |
| Backup-vendor suggestion on alert | 220 | 2 | 50% | 4 | **55** |

## How to read it
- **Impact scale:** 3 = massive, 2 = high, 1 = medium, 0.5 = low.
- **The dispatch alert wins** because it reaches every order, has high impact and is cheap to build.
- **Early watch has low confidence** because on the sample data it is right only about 30% of the time, barely better than the 25% base late rate.
- **GPS tracking scores lower now** because of effort, but it is the only way to catch the ~20% of late orders that leave the plant on time. It leads v2.
- **Backup-vendor suggestion** reaches fewer orders (only those that get an alert) and its confidence is low until vendors agree to take short-notice orders.
