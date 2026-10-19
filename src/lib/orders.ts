/** Shared order types and plain-English reasons built from the score's pts_* columns. */

export interface OrderRow {
  order_id: string;
  customer_id: string;
  site_name: string;
  vendor_id: string;
  vendor_name: string;
  material: string;
  qty_ordered: number;
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
  status: string;
}

export const ORDER_COLUMNS = `o.order_id, o.customer_id, o.site_name, o.vendor_id, v.vendor_name, o.material, o.qty_ordered, o.unit,
  o.order_ts, o.promised_ts, o.dispatch_planned_ts, o.dispatch_actual_ts, o.check_ts, o.delivered_ts, o.delay_hours,
  o.distance_km, o.vendor_recent_otif, o.risk_score, o.pts_dispatch_late, o.pts_vendor_recent_otif_below_80,
  o.pts_distance_over_50km, o.pts_ordered_under_24h, o.pts_monsoon, o.alert, o.alert_lead_hours, o.status`;

export interface Reason {
  key: string;
  points: number;
  /** Short label for chips. */
  label: string;
  /** Full sentence for the alert screen. */
  sentence: string;
}

/** "2026-09-26 04:54" → "04:54" */
export const hhmm = (ts: string | null | undefined) => (ts ? ts.slice(11, 16) : "–");

/** Plain-English reasons, in the order the score adds them. Only reasons that scored points are returned. */
export function reasonsFor(o: OrderRow): Reason[] {
  const out: Reason[] = [];
  if (o.pts_dispatch_late > 0)
    out.push({
      key: "dispatch",
      points: o.pts_dispatch_late,
      label: "Truck not dispatched",
      sentence: `The truck has not left the plant. It was due out at ${hhmm(o.dispatch_planned_ts)}.`,
    });
  if (o.pts_vendor_recent_otif_below_80 > 0) {
    const pct = o.vendor_recent_otif === null ? null : Math.round(o.vendor_recent_otif * 100);
    out.push({
      key: "vendor",
      points: o.pts_vendor_recent_otif_below_80,
      label: "Vendor's recent record",
      sentence:
        pct === null
          ? `${o.vendor_name} has a weak recent record.`
          : `${o.vendor_name} was on time and in full on only ${pct}% of its last 10 orders.`,
    });
  }
  if (o.pts_distance_over_50km > 0)
    out.push({
      key: "distance",
      points: o.pts_distance_over_50km,
      label: "Long route",
      sentence: `The site is ${Math.round(o.distance_km)} km from the plant, a long route.`,
    });
  if (o.pts_ordered_under_24h > 0)
    out.push({
      key: "rush",
      points: o.pts_ordered_under_24h,
      label: "Rush order",
      sentence: "It was ordered less than 24 hours before it is needed.",
    });
  if (o.pts_monsoon > 0)
    out.push({
      key: "monsoon",
      points: o.pts_monsoon,
      label: "Monsoon",
      sentence: "It is monsoon season, when delays are more likely.",
    });
  return out;
}

/** The order used in the home-page hero: a late ready-mix concrete order that scored every warning sign. */
export const HERO_ORDER_ID = "O01162";
