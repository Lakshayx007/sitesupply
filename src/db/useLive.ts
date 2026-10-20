import { useMemo } from "react";
import { LIVE_COLUMNS, type LiveOrder } from "../lib/live";
import { vendorScores, type VendorScore } from "../lib/orders";
import { useQuery } from "./useQuery";

type Live = { loading: boolean; orders: LiveOrder[]; vendors: VendorScore[]; byId: Map<string, LiveOrder> };
/** Derived data is shared between every console on the page (the home page has several). */
const derived = new WeakMap<object, Live>();

/** Every order (1,158 rows) plus vendor reliability, loaded once from the in-browser database. */
export function useLive(): { loading: boolean; orders: LiveOrder[]; vendors: VendorScore[]; byId: Map<string, LiveOrder> } {
  const q = useQuery<LiveOrder>(`SELECT ${LIVE_COLUMNS} FROM orders o JOIN vendors v USING (vendor_id) ORDER BY o.promised_ts`);
  const vm = useQuery<{ vendor_id: string; materials: string }>("SELECT vendor_id, materials FROM vendors");
  return useMemo(() => {
    const hit = derived.get(q.rows);
    if (hit && !vm.loading) return hit;
    const materials = Object.fromEntries(vm.rows.map((r) => [r.vendor_id, r.materials.split("|")]));
    const out = {
      loading: q.loading || vm.loading,
      orders: q.rows,
      vendors: q.rows.length ? vendorScores(q.rows, materials) : [],
      byId: new Map(q.rows.map((o) => [o.order_id, o])),
    };
    if (q.rows.length && vm.rows.length) derived.set(q.rows, out);
    return out;
  }, [q.rows, q.loading, vm.rows, vm.loading]);
}
