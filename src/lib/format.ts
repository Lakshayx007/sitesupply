/** Number formatting helpers (en-IN digit grouping is the same as en-US below 1 lakh). */

/** 0.7 → "70.0%" */
export function pct(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  return `${(x * 100).toFixed(digits)}%`;
}

/** 1138 → "1,138" */
export function int(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  return Math.round(x).toLocaleString("en-US");
}

/** 2.5 → "2.5 h" */
export function hours(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "–";
  return `${x.toFixed(digits)} h`;
}
