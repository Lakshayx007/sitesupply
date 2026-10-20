/**
 * The live status of an order at a moment in time ("now", set by the replay control).
 * Follows the status logic in CLAUDE.md exactly:
 *   - before check_ts: early score (no dispatch points) ≥ 25 → Watch, else On track
 *   - from check_ts until delivery: risk_score ≥ 50 → At risk, else On track
 *   - delivered: Delivered (OTIF), Delivered late (not on time) or Delivered short (on time, not in full)
 * Plus one state from the explainer's list: past the promised time and still not delivered → Delayed.
 */

export interface LiveOrder {
  order_id: string;
  customer_id: string;
  site_name: string;
  vendor_id: string;
  vendor_name: string;
  material_id: string;
  material: string;
  qty_ordered: number;
  qty_delivered: number | null;
  unit: string;
  order_ts: string;
  promised_ts: string;
  dispatch_planned_ts: string;
  dispatch_actual_ts: string | null;
  check_ts: string;
  delivered_ts: string | null;
  delay_hours: number | null;
  distance_km: number;
  vendor_recent_otif: number | null;
  risk_score: number;
  pts_dispatch_late: number;
  pts_vendor_recent_otif_below_80: number;
  pts_distance_over_50km: number;
  pts_ordered_under_24h: number;
  pts_monsoon: number;
  alert: number;
  alert_lead_hours: number | null;
  on_time: number | null;
  in_full: number | null;
  otif: number | null;
  cancelled: number;
}

export const LIVE_COLUMNS = `o.order_id, o.customer_id, o.site_name, o.vendor_id, v.vendor_name, o.material_id, o.material,
  o.qty_ordered, o.qty_delivered, o.unit, o.order_ts, o.promised_ts, o.dispatch_planned_ts, o.dispatch_actual_ts,
  o.check_ts, o.delivered_ts, o.delay_hours, o.distance_km, o.vendor_recent_otif, o.risk_score, o.pts_dispatch_late,
  o.pts_vendor_recent_otif_below_80, o.pts_distance_over_50km, o.pts_ordered_under_24h, o.pts_monsoon, o.alert,
  o.alert_lead_hours, o.on_time, o.in_full, o.otif, o.cancelled`;

import { getAlertRule, isAlert, type AlertRule } from "./alertRule";

export type LiveStatus = "on-track" | "watch" | "at-risk" | "delayed" | "delivered" | "delivered-late" | "delivered-short";

export type Stage = "ordered" | "confirmed" | "dispatched" | "in-transit" | "delivered";

/** Minutes since epoch for "YYYY-MM-DD HH:MM" timestamps (treated as one local clock). */
export const ts = (s: string): number => Date.parse(s.replace(" ", "T") + ":00Z") / 60000;
export const fromMin = (m: number): string => new Date(m * 60000).toISOString().slice(0, 16).replace("T", " ");

export const earlyScore = (o: LiveOrder) =>
  o.pts_vendor_recent_otif_below_80 + o.pts_distance_over_50km + o.pts_ordered_under_24h + o.pts_monsoon;

export const WATCH_AT = 25;
export const ALERT_AT = 50;

/** Is the order visible on the board at `now`? Placed, not cancelled. */
export const isPlaced = (o: LiveOrder, now: number) => o.cancelled === 0 && ts(o.order_ts) <= now;

export const isDelivered = (o: LiveOrder, now: number) => o.delivered_ts !== null && ts(o.delivered_ts) <= now;

export function liveStatus(o: LiveOrder, now: number, rule: AlertRule = getAlertRule()): LiveStatus {
  if (isDelivered(o, now)) {
    if (o.otif === 1) return "delivered";
    if (o.on_time === 0) return "delivered-late";
    return "delivered-short";
  }
  if (now >= ts(o.promised_ts)) return "delayed";
  if (now < ts(o.check_ts)) return earlyScore(o) >= WATCH_AT ? "watch" : "on-track";
  if (isAlert(o, rule)) return "at-risk";
  // Under the dispatch rule, a high score without a late truck stays on Watch instead of alerting.
  return o.risk_score >= ALERT_AT ? "watch" : "on-track";
}

/** The score the system can show at `now`: early score before the check, full score after. */
export function liveScore(o: LiveOrder, now: number): { score: number; full: boolean } {
  return now < ts(o.check_ts) ? { score: earlyScore(o), full: false } : { score: o.risk_score, full: true };
}

/** Has an alert been sent by `now`? Alerts go out at the dispatch check (check_ts). See alertRule.ts. */
export const alertSent = (o: LiveOrder, now: number, rule: AlertRule = getAlertRule()) => isAlert(o, rule) && now >= ts(o.check_ts);

export function stage(o: LiveOrder, now: number): Stage {
  if (isDelivered(o, now)) return "delivered";
  if (o.dispatch_actual_ts && now >= ts(o.dispatch_actual_ts)) return "in-transit";
  if (now >= ts(o.order_ts)) return "confirmed";
  return "ordered";
}

/** Sort order on the board: what needs attention first. */
export const STATUS_RANK: Record<LiveStatus, number> = {
  delayed: 0,
  "at-risk": 1,
  watch: 2,
  "on-track": 3,
  "delivered-late": 4,
  "delivered-short": 5,
  delivered: 6,
};

/** Replay window: the 25 weeks of sample data. */
export const WINDOW = { start: ts("2026-04-06 00:00"), end: ts("2026-09-28 00:00") };
/** Default "now": just after a ready-mix alert fires, so the board opens with something to act on. */
export const DEFAULT_NOW = ts("2026-09-26 06:00");

/**
 * The moment to open a site on: shortly after the dispatch check of its latest alert that turned out
 * right (the delivery really was late), so the phone opens on an at-risk delivery still on the way.
 */
export function alertMoment(orders: LiveOrder[], site: string, rule: AlertRule = getAlertRule()): number | null {
  const alerted = orders.filter((o) => o.customer_id === site && o.cancelled === 0 && isAlert(o, rule));
  const late = alerted.filter((o) => o.on_time === 0);
  const pick = (late.length ? late : alerted).sort((a, b) => ts(b.check_ts) - ts(a.check_ts))[0];
  if (!pick) return null;
  const at = ts(pick.check_ts) + 15;
  return pick.delivered_ts && ts(pick.delivered_ts) <= at ? ts(pick.check_ts) : at;
}
