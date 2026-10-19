/** Plain-English reasons built from the score's pts_* columns, plus vendor helpers. */
import type { LiveOrder } from "./live";
import { shrink, wilson } from "./stats";

export interface Reason {
  key: string;
  points: number;
  /** Short label for chips. */
  label: string;
  /** Full sentence for the alert screen. */
  sentence: string;
}

/** "2026-09-26 04:54" → "04:54" */
export const hhmm = (t: string | null | undefined) => (t ? t.slice(11, 16) : "–");
/** "2026-09-26 04:54" → "26 Sep" */
export const dayMonth = (t: string | null | undefined) => {
  if (!t) return "–";
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(t.slice(5, 7)) - 1];
  return `${Number(t.slice(8, 10))} ${m}`;
};
export const unitLabel = (u: string) => (u === "m3" ? "m³" : u);

type ReasonInput = Pick<
  LiveOrder,
  | "pts_dispatch_late"
  | "pts_vendor_recent_otif_below_80"
  | "pts_distance_over_50km"
  | "pts_ordered_under_24h"
  | "pts_monsoon"
  | "vendor_name"
  | "vendor_recent_otif"
  | "distance_km"
  | "dispatch_planned_ts"
>;

/**
 * Reasons in the order the score adds them. Only reasons that scored points are returned.
 * Before the dispatch check (`full = false`) the dispatch reason is not known yet.
 */
export function reasonsFor(o: ReasonInput, full = true): Reason[] {
  const out: Reason[] = [];
  if (full && o.pts_dispatch_late > 0)
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
      sentence: `The site is ${Math.round(o.distance_km)} km from the plant.`,
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

export interface VendorScore {
  vendor_id: string;
  vendor_name: string;
  materials: string[];
  n: number;
  s: number;
  otif: number;
  lo: number;
  hi: number;
  adjusted: number;
}

/** Reliability per vendor over all delivered orders: raw OTIF, Wilson range, shrunk ("adjusted") OTIF with k = 20. */
export function vendorScores(
  orders: Pick<LiveOrder, "vendor_id" | "vendor_name" | "otif" | "cancelled">[],
  vendorMaterials: Record<string, string[]>,
  k = 20,
): VendorScore[] {
  const delivered = orders.filter((o) => o.cancelled === 0 && o.otif !== null);
  const pbar = delivered.reduce((a, o) => a + (o.otif ?? 0), 0) / delivered.length;
  const by = new Map<string, { name: string; n: number; s: number }>();
  for (const o of delivered) {
    const v = by.get(o.vendor_id) ?? { name: o.vendor_name, n: 0, s: 0 };
    v.n++;
    v.s += o.otif ?? 0;
    by.set(o.vendor_id, v);
  }
  return [...by.entries()].map(([id, v]) => {
    const [lo, hi] = wilson(v.s, v.n);
    return {
      vendor_id: id,
      vendor_name: v.name,
      materials: vendorMaterials[id] ?? [],
      n: v.n,
      s: v.s,
      otif: v.s / v.n,
      lo,
      hi,
      adjusted: shrink(v.s, v.n, pbar, k),
    };
  });
}

/** Backup vendor: the most reliable other vendor (by adjusted OTIF) that supplies the same material. */
export function backupVendor(scores: VendorScore[], materialId: string, exclude: string): VendorScore | null {
  return (
    scores
      .filter((v) => v.vendor_id !== exclude && v.materials.includes(materialId))
      .sort((a, b) => b.adjusted - a.adjusted)[0] ?? null
  );
}

/** The order used across the home page: a late ready-mix concrete order that scored every warning sign. */
export const HERO_ORDER_ID = "O01162";
