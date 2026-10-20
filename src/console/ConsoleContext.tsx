import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLive } from "../db/useLive";
import { isAlert, useAlertRule, type AlertRule } from "../lib/alertRule";
import { DEFAULT_NOW, WINDOW, ts, type LiveOrder } from "../lib/live";
import type { VendorScore } from "../lib/orders";

/** Shared state for the console: the replay clock and the order data. */
interface ConsoleState {
  now: number;
  setNow: (m: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  speed: number; // simulated minutes per real second
  setSpeed: (s: number) => void;
  loading: boolean;
  orders: LiveOrder[];
  vendors: VendorScore[];
  byId: Map<string, LiveOrder>;
  /** The alert rule in force (the provider re-renders when it changes). */
  rule: AlertRule;
  /** Jumps to the next alert after `now` and returns its order id. */
  nextAlert: () => string | null;
}

const Ctx = createContext<ConsoleState | null>(null);

export function useConsole(): ConsoleState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useConsole outside ConsoleProvider");
  return c;
}

export function ConsoleProvider({ children, initialNow = DEFAULT_NOW }: { children: ReactNode; initialNow?: number }) {
  const live = useLive();
  const rule = useAlertRule();
  const [now, setNowRaw] = useState(initialNow);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(120);
  const nowRef = useRef(now);
  nowRef.current = now;

  const setNow = useCallback((m: number) => setNowRaw(Math.min(WINDOW.end, Math.max(WINDOW.start, Math.round(m)))), []);

  useEffect(() => {
    if (!playing) return;
    // Ten clock steps a second is smooth enough for a replay and keeps the main thread free.
    let last = performance.now();
    const id = window.setInterval(() => {
      const t = performance.now();
      const next = nowRef.current + ((t - last) / 1000) * speed;
      last = t;
      if (next >= WINDOW.end) {
        setNowRaw(WINDOW.end);
        setPlaying(false);
      } else setNowRaw(next);
    }, 100);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  const alertTimes = useMemo(
    () =>
      live.orders
        .filter((o) => o.cancelled === 0 && isAlert(o, rule))
        .map((o) => ({ t: ts(o.check_ts), id: o.order_id }))
        .sort((a, b) => a.t - b.t),
    [live.orders, rule],
  );

  const nextAlert = useCallback(() => {
    const n = alertTimes.find((a) => a.t > Math.floor(nowRef.current));
    if (!n) return null;
    setPlaying(false);
    setNow(n.t + 1);
    return n.id;
  }, [alertTimes, setNow]);

  const value: ConsoleState = {
    now: Math.floor(now),
    setNow,
    playing,
    setPlaying,
    speed,
    setSpeed,
    loading: live.loading,
    orders: live.orders,
    vendors: live.vendors,
    byId: live.byId,
    rule,
    nextAlert,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
