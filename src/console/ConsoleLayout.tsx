import { BarChart3, Bell, ChevronLeft, FastForward, LayoutList, Pause, Play, Smartphone, Sparkles, Users } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { WINDOW, alertSent, fromMin, ts } from "../lib/live";
import { useConsole } from "./ConsoleContext";

type NavItem = { to: string; label: string; short?: string; icon: typeof Bell; end?: boolean; mobile?: boolean };

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Operations",
    items: [
      { to: "/console", label: "Live board", short: "Board", icon: LayoutList, end: true, mobile: true },
      { to: "/console/alerts", label: "Alerts", icon: Bell, mobile: true },
      { to: "/console/site", label: "Site engineer view", short: "Site view", icon: Smartphone },
    ],
  },
  {
    group: "Insight",
    items: [
      { to: "/console/vendors", label: "Vendors", icon: Users, mobile: true },
      { to: "/console/analytics", label: "Analytics", icon: BarChart3, mobile: true },
      { to: "/console/ask", label: "Ask SiteSupply", short: "Ask", icon: Sparkles, mobile: true },
    ],
  },
];
const ALL = NAV.flatMap((g) => g.items);
/** Pages that read the whole history, so the replay clock does not apply. */
const NO_CLOCK = ["/console/ask", "/console/vendors", "/console/analytics"];

const SPEEDS = [
  { v: 60, label: "1 h/s" },
  { v: 360, label: "6 h/s" },
  { v: 1440, label: "1 day/s" },
];

export function fmtClock(m: number) {
  const d = new Date(m * 60000);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return { day: `${wd} ${d.getUTCDate()} ${mo}`, time: fromMin(m).slice(11, 16) };
}

function ReplayBar() {
  const { now, setNow, playing, setPlaying, speed, setSpeed, nextAlert } = useConsole();
  const navigate = useNavigate();
  const { day, time } = fmtClock(now);
  const pct = ((now - WINDOW.start) / (WINDOW.end - WINDOW.start)) * 100;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel/80 px-4 py-2.5 backdrop-blur lg:px-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPlaying(!playing)}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-fg hover:bg-primary-hover"
          aria-label={playing ? "Pause replay" : "Play replay"}
        >
          {playing ? <Pause aria-hidden="true" className="h-4 w-4 fill-current" /> : <Play aria-hidden="true" className="h-4 w-4 fill-current" />}
        </button>
        <div className="w-[118px] leading-tight" aria-live="off">
          <p className="num text-base font-semibold text-ink">{time}</p>
          <p className="text-[11px] text-muted">{day} 2026</p>
        </div>
      </div>
      <div className="order-last flex min-w-[200px] flex-1 basis-full items-center gap-3 sm:order-none sm:basis-auto">
        <label htmlFor="replay" className="sr-only">
          Replay time
        </label>
        <input
          id="replay"
          type="range"
          min={WINDOW.start}
          max={WINDOW.end}
          step={30}
          value={now}
          onChange={(e) => {
            setPlaying(false);
            setNow(Number(e.target.value));
          }}
          aria-valuetext={`${day}, ${time}`}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-raised accent-[rgb(var(--primary))]"
          style={{ background: `linear-gradient(to right, rgb(var(--primary)) ${pct}%, rgb(var(--raised)) ${pct}%)` }}
        />
        <span className="hidden whitespace-nowrap text-[11px] text-muted md:inline">6 Apr to 27 Sep</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div role="group" aria-label="Replay speed" className="hidden rounded-md border border-line p-0.5 text-[11px] sm:flex">
          {SPEEDS.map((s) => (
            <button
              key={s.v}
              onClick={() => setSpeed(s.v)}
              aria-pressed={speed === s.v}
              className={`rounded px-2 py-1 ${speed === s.v ? "bg-raised text-ink" : "text-muted hover:text-ink"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            const id = nextAlert();
            if (id) navigate(`/console/order/${id}`);
          }}
          className="btn-secondary min-h-[32px] px-3 text-xs"
        >
          <FastForward aria-hidden="true" className="h-3.5 w-3.5" />
          Next alert
        </button>
      </div>
    </div>
  );
}

export function ConsoleLayout() {
  const { orders, now } = useConsole();
  const { pathname } = useLocation();
  const recentAlerts = orders.filter((o) => alertSent(o, now) && now - ts(o.check_ts) < 24 * 60 && !(o.delivered_ts && ts(o.delivered_ts) <= now)).length;

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-canvas lg:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-line bg-panel lg:flex">
        <div className="flex h-14 items-center px-4">
          <Logo />
        </div>
        <nav aria-label="Console" className="flex flex-col gap-0.5 px-2 py-2">
          {NAV.map((g) => (
            <div key={g.group} className="mb-3">
              <p className="px-2.5 pb-1 pt-1 text-[11px] font-medium text-muted">{g.group}</p>
          {g.items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm ${isActive ? "bg-raised text-ink" : "text-ink-2 hover:bg-raised/60 hover:text-ink"}`
              }
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
              {to === "/console/alerts" && recentAlerts > 0 && (
                <span className="num ml-auto rounded-full bg-risk/15 px-1.5 text-[11px] font-semibold text-risk">{recentAlerts}</span>
              )}
            </NavLink>
          ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto border-t border-line p-3">
          <NavLink to="/" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted hover:text-ink">
            <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
            Back to the website
          </NavLink>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex h-12 items-center justify-between border-b border-line bg-panel px-4 lg:hidden">
        <Logo />
        <div className="flex items-center gap-4">
          <NavLink to="/console/site" className="text-xs text-muted hover:text-ink">
            Phone view
          </NavLink>
          <NavLink to="/" className="text-xs text-muted hover:text-ink">
            Exit
          </NavLink>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!NO_CLOCK.includes(pathname) && <ReplayBar />}
        <main id="main" tabIndex={-1} className="min-h-0 flex-1 focus:outline-none">
          <Outlet />
        </main>
        {/* Mobile tab bar */}
        <nav aria-label="Console" className="grid grid-cols-5 border-t border-line bg-panel lg:hidden">
          {ALL.filter((n) => n.mobile).map(({ to, label, short, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `flex flex-col items-center gap-1 py-2 text-[11px] ${isActive ? "text-ink" : "text-muted"}`}
            >
              <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
              {short ?? label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
