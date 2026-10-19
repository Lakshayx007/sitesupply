import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLive } from "../db/useLive";
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
  const [now, setNowRaw] = useState(initialNow);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(120);
  const nowRef = useRef(now);
  nowRef.current = now;

  const setNow = useCallback((m: number) => setNowRaw(Math.min(WINDOW.end, Math.max(WINDOW.start, Math.round(m)))), []);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const next = nowRef.current + dt * speed;
      if (next >= WINDOW.end) {
        setNowRaw(WINDOW.end);
        setPlaying(false);
        return;
      }
      setNowRaw(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const alertTimes = useMemo(
    () =>
      live.orders
        .filter((o) => o.alert === 1 && o.cancelled === 0)
        .map((o) => ({ t: ts(o.check_ts), id: o.order_id }))
        .sort((a, b) => a.t - b.t),
    [live.orders],
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
    nextAlert,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
