/**
 * Which orders get a loud alert. A setting the site team can change on the Alert tuning page.
 *  - "dispatch" (default): score of 50+ AND the truck was late leaving the plant. Other 50+ orders show as Watch.
 *  - "score": score of 50+ alone (the original rule in the brief).
 * On the sample data the default cuts false alarms from 188 to 73 and keeps 77% of late orders caught (was 83%).
 */
import { useSyncExternalStore } from "react";

export type AlertRule = "dispatch" | "score";
export const ALERT_AT = 50;

const KEY = "sitesupply-alert-rule";
let rule: AlertRule = "dispatch";
try {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  if (saved === "score" || saved === "dispatch") rule = saved;
} catch {
  /* storage unavailable: keep the default */
}
const listeners = new Set<() => void>();

export const getAlertRule = (): AlertRule => rule;

export function setAlertRule(r: AlertRule) {
  rule = r;
  try {
    localStorage.setItem(KEY, r);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useAlertRule(): AlertRule {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => rule,
    () => rule,
  );
}

/** Would this order trigger a loud alert at the dispatch check, under `r`? */
export function isAlert(o: { risk_score: number; pts_dispatch_late: number }, r: AlertRule = rule, threshold = ALERT_AT): boolean {
  return o.risk_score >= threshold && (r === "score" || o.pts_dispatch_late > 0);
}
