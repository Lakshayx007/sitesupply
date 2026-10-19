import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, Clock, Eye, LoaderCircle, PackageMinus, TriangleAlert, type LucideIcon } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { LiveStatus } from "../lib/live";

/* ---------- Status: colour + icon + label, never colour alone ---------- */

const STATUS: Record<LiveStatus, { label: string; icon: LucideIcon; tone: string }> = {
  "on-track": { label: "On track", icon: CircleCheck, tone: "text-good border-good/30 bg-good/10" },
  watch: { label: "Watch", icon: Eye, tone: "text-watch border-watch/30 bg-watch/10" },
  "at-risk": { label: "At risk", icon: TriangleAlert, tone: "text-risk border-risk/35 bg-risk/10" },
  delayed: { label: "Delayed", icon: Clock, tone: "text-late border-late/35 bg-late/10" },
  delivered: { label: "Delivered", icon: CircleCheck, tone: "text-ink-2 border-line-strong bg-raised" },
  "delivered-late": { label: "Delivered late", icon: Clock, tone: "text-late border-late/30 bg-late/[0.07]" },
  "delivered-short": { label: "Delivered short", icon: PackageMinus, tone: "text-risk border-risk/30 bg-risk/[0.07]" },
};

export const statusLabel = (s: LiveStatus) => STATUS[s].label;

export function StatusChip({ status, size = "sm" }: { status: LiveStatus; size?: "sm" | "md" }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border font-medium ${s.tone} ${
        size === "md" ? "px-2.5 py-1 text-[13px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <Icon aria-hidden="true" className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {s.label}
    </span>
  );
}

/** 0–100 risk badge: a small ring that fills with the score. */
export function RiskBadge({ score, status, size = 32 }: { score: number; status?: LiveStatus; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  // The ring takes the colour of the order's status; without one, 50+ reads as risk.
  const tone = status ? (status === "at-risk" || status === "delayed" ? "risk" : status === "watch" ? "watch" : "calm") : score >= 50 ? "risk" : "calm";
  const ring = tone === "risk" ? "stroke-risk" : tone === "watch" ? "stroke-watch" : "stroke-primary-ink";
  const text = tone === "risk" ? "text-risk" : tone === "watch" ? "text-watch" : "text-ink-2";
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`Risk ${score} of 100`}
      role="img"
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="2.5" className="stroke-line-strong" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
          className={ring}
          style={{ transition: "stroke-dasharray 400ms ease" }}
        />
      </svg>
      <span className={`num absolute text-[11px] font-semibold ${text}`}>{score}</span>
    </span>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
      {label}
    </span>
  );
}

export function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`mx-auto max-w-page px-4 sm:px-6 ${className}`}>
      {children}
    </section>
  );
}

/* ---------- Toasts ---------- */

interface Toast {
  id: number;
  text: string;
  icon?: LucideIcon;
}
const ToastCtx = createContext<(text: string, icon?: LucideIcon) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const id = useRef(0);
  const push = useCallback((text: string, icon?: LucideIcon) => {
    const t = { id: ++id.current, text, icon };
    setToasts((all) => [...all.slice(-2), t]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== t.id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = t.icon ?? CircleCheck;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                className="pointer-events-auto flex items-center gap-2 rounded-lg border border-line-strong bg-overlay px-3.5 py-2.5 text-sm text-ink shadow-pop"
              >
                <Icon aria-hidden="true" className="h-4 w-4 text-good" />
                {t.text}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
