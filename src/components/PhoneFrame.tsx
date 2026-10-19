import type { ReactNode } from "react";

/**
 * A phone shell with the 390×844 proportions of the brief.
 * `width` sets the rendered size; the content inside is laid out normally.
 * On small screens the demo pages render without the frame (see `bare`).
 */
export function PhoneFrame({
  children,
  width = 390,
  time = "09:41",
  label,
  className = "",
  bare = false,
}: {
  children: ReactNode;
  width?: number;
  /** Time shown in the status bar. */
  time?: string;
  /** Accessible name for the device mock-up. */
  label?: string;
  className?: string;
  /** Skip the device chrome (full-screen on phones). */
  bare?: boolean;
}) {
  if (bare) return <div className={className}>{children}</div>;

  return (
    <div
      role={label ? "group" : undefined}
      aria-label={label}
      className={`relative shrink-0 rounded-[48px] bg-[#0B1220] p-[10px] shadow-phone ${className}`}
      style={{ width, maxWidth: "100%", aspectRatio: "390 / 844" }}
    >
      {/* side buttons */}
      <span aria-hidden="true" className="absolute -left-[3px] top-[18%] h-10 w-[3px] rounded-l bg-[#1E293B]" />
      <span aria-hidden="true" className="absolute -left-[3px] top-[27%] h-16 w-[3px] rounded-l bg-[#1E293B]" />
      <span aria-hidden="true" className="absolute -right-[3px] top-[22%] h-20 w-[3px] rounded-r bg-[#1E293B]" />

      <div className="relative flex h-full flex-col overflow-hidden rounded-[38px] bg-subtle">
        {/* status bar */}
        <div aria-hidden="true" className="relative z-20 flex h-11 shrink-0 items-center justify-between px-7 pt-1 text-[13px] font-semibold text-ink">
          <span className="num tabular-nums">{time}</span>
          <span className="absolute left-1/2 top-2 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-[#0B1220]" />
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 18 12" className="h-3 w-[18px] fill-current">
              <rect x="0" y="8" width="3" height="4" rx="1" />
              <rect x="5" y="5" width="3" height="7" rx="1" />
              <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
              <rect x="15" y="0" width="3" height="12" rx="1" />
            </svg>
            <svg viewBox="0 0 26 12" className="h-3 w-[26px]">
              <rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.4" />
              <rect x="2" y="2" width="16" height="8" rx="1.6" fill="currentColor" />
              <rect x="23.5" y="4" width="1.8" height="4" rx="0.8" fill="currentColor" opacity="0.4" />
            </svg>
          </span>
        </div>
        <div className="relative min-h-0 flex-1">{children}</div>
        <span aria-hidden="true" className="absolute bottom-2 left-1/2 z-20 h-[5px] w-[120px] -translate-x-1/2 rounded-full bg-ink/80" />
      </div>
    </div>
  );
}
