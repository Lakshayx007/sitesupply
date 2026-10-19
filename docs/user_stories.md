# User stories

Eight stories for the first releases. Stories 1 to 3 come from the project explainer; 4 to 8 cover the vendor dispatcher, the operations manager, the backup vendor, rescheduling and alert settings. Each has acceptance criteria in Given / When / Then form.

## 1. Delay alert for the site engineer
**As a** site engineer, **I want** to be warned when a delivery is likely to be late, **so that** I can re-plan the crew.

- **Given** an order whose score reaches 50
- **When** the score is updated at the dispatch check
- **Then** I get an alert within 5 minutes showing the reasons in plain words and three actions: call the vendor, switch to a backup vendor, reschedule the work.

## 2. Reliability next to price
**As a** procurement manager, **I want** to see each vendor's reliability next to their price, **so that** I don't pick a cheap vendor who is always late.

- **Given** I am choosing a vendor
- **When** I view the quote list
- **Then** each vendor shows its adjusted on-time-in-full rate and its 95% confidence range.

## 3. Weekly OTIF on a control chart
**As an** operations manager, **I want** weekly OTIF on a control chart, **so that** I react to real changes and not to noise.

- **Given** the dashboard
- **When** a week falls outside the normal range
- **Then** it is highlighted with the orders behind it.

## 4. Early nudge for the vendor dispatcher
**As a** vendor dispatcher, **I want** a nudge when a truck has not left an hour after its planned dispatch, **so that** I can send it or tell the site before they call me angry.

- **Given** an order whose truck has no dispatch time an hour after the planned dispatch
- **When** the dispatch check runs
- **Then** the vendor's dispatch desk receives a message with the order, the site, the promised time and a one-tap "Truck left at…" reply.

## 5. Vendor scorecard for the operations manager
**As an** operations manager, **I want** a monthly scorecard per vendor, **so that** I can have a fair conversation about reliability, backed by numbers.

- **Given** a vendor with at least one delivered order in the month
- **When** I open the vendor scorecard
- **Then** I see orders, raw OTIF, the 95% range, adjusted OTIF and average delay, and vendors with few orders are marked as uncertain rather than ranked at the top or bottom.

## 6. Switch to a backup vendor
**As a** site engineer, **I want** the alert to suggest a backup vendor for the same material, **so that** I can place a second order in one step when the first truck clearly won't make it.

- **Given** an alert on an order
- **When** I tap "Switch to backup vendor"
- **Then** I see the most reliable other vendor that supplies the same material (by adjusted OTIF), with its price index, and can send them the order details.

## 7. Reschedule the work
**As a** site engineer, **I want** to mark the dependent work as rescheduled from the alert, **so that** the crew and equipment bookings move without a round of phone calls.

- **Given** an alert on an order linked to a planned activity (for example a slab pour)
- **When** I tap "Reschedule work" and pick a new time
- **Then** the activity moves, the crew lead is notified, and the alert records that action was taken.

## 8. Alert settings
**As a** site engineer, **I want** to choose which orders alert me and how, **so that** I get the warnings that matter without alert fatigue.

- **Given** the alert settings screen
- **When** I set a quiet window, the materials I care about and the channel (app or WhatsApp)
- **Then** alerts follow those settings, and I can see how many alerts a week I would have received under them.
