/**
 * SiteSupply statistics, computed live in the browser.
 *
 * Every function here mirrors what scripts/analysis.py does in Python, so the
 * website and data/stats_summary.json always agree. The tests in stats.test.ts
 * check that against the sample data.
 */

/** Standard normal cumulative distribution function. */
export function normCdf(x: number): number {
  // Abramowitz & Stegun 7.1.26 via erf, accurate to ~1e-7.
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + sign * y);
}

/** Inverse of the standard normal CDF (Acklam's algorithm, relative error < 1.2e-9). */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    throw new RangeError(`normInv: p must be in (0, 1), got ${p}`);
  }
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/**
 * Wilson score interval for a proportion.
 * Behaves well for small n and for rates near 0% or 100%.
 * Same as statsmodels `proportion_confint(method="wilson")`.
 */
export function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [0, 1];
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/**
 * Empirical-Bayes shrinkage of a rate toward a prior mean.
 * `k` is the prior strength in "orders' worth" of the average vendor (the site uses k = 20).
 */
export function shrink(successes: number, n: number, priorMean: number, k: number): number {
  if (n + k <= 0) return priorMean;
  return (successes + priorMean * k) / (n + k);
}

/**
 * Percentile with linear interpolation between closest ranks,
 * the same as pandas `Series.quantile()` and numpy's default.
 * `p` is on a 0–100 scale (e.g. 90 for the 90th percentile).
 * Non-finite values (NaN, null-as-NaN) are ignored, like pandas does.
 */
export function percentile(values: readonly number[], p: number): number {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return NaN;
  const q = Math.min(100, Math.max(0, p)) / 100;
  const pos = (xs.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo);
}

/** Median (50th percentile). */
export function median(values: readonly number[]): number {
  return percentile(values, 50);
}

/** Arithmetic mean, ignoring non-finite values. */
export function mean(values: readonly number[]): number {
  const xs = values.filter((v) => Number.isFinite(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

export interface Confusion {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  /** Of the alerts sent, the share that were right. 0 when no alerts. */
  precision: number;
  /** Of the late orders, the share that got an alert. 0 when no late orders. */
  recall: number;
}

/**
 * Confusion matrix for "alert when score ≥ threshold" against the actual outcome.
 * `late[i]` is truthy (1 / true) when order i was actually late.
 */
export function confusion(scores: readonly number[], late: readonly (number | boolean)[], threshold: number): Confusion {
  if (scores.length !== late.length) throw new Error("confusion: scores and late must be the same length");
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (let i = 0; i < scores.length; i++) {
    const flagged = scores[i] >= threshold;
    const isLate = Boolean(late[i]);
    if (flagged && isLate) tp++;
    else if (flagged) fp++;
    else if (isLate) fn++;
    else tn++;
  }
  return {
    tp,
    fp,
    fn,
    tn,
    precision: tp + fp > 0 ? tp / (tp + fp) : 0,
    recall: tp + fn > 0 ? tp / (tp + fn) : 0,
  };
}

/** Cohen's h effect size between two proportions. */
export function cohensH(p1: number, p2: number): number {
  return 2 * Math.asin(Math.sqrt(p2)) - 2 * Math.asin(Math.sqrt(p1));
}

/**
 * Orders needed in EACH arm of a two-sided A/B test comparing two proportions,
 * using Cohen's h and the normal approximation (matches statsmodels
 * `NormalIndPower().solve_power(proportion_effectsize(p2, p1), alpha, power, ratio=1)`).
 *
 * The arcsine transform 2·asin(√p) has variance 1/n, so the difference between
 * two equal arms has variance 2/n, giving n = 2 · ((z₁₋α/₂ + z_power) / h)².
 */
export function sampleSizeTwoProportions(p1: number, p2: number, alpha = 0.05, power = 0.8): number {
  const h = Math.abs(cohensH(p1, p2));
  if (h === 0) return Infinity;
  const zAlpha = normInv(1 - alpha / 2);
  const zBeta = normInv(power);
  return Math.ceil((2 * (zAlpha + zBeta) ** 2) / (h * h));
}

/**
 * p-chart control limits for a week with `n` orders around the average rate `pbar`:
 * [max(0, p̄ − 3σ), min(1, p̄ + 3σ)] with σ = √(p̄(1 − p̄)/n).
 */
export function pchartLimits(pbar: number, n: number): [number, number] {
  if (n <= 0) return [0, 1];
  const sigma = Math.sqrt((pbar * (1 - pbar)) / n);
  return [Math.max(0, pbar - 3 * sigma), Math.min(1, pbar + 3 * sigma)];
}

/** Round to a number of decimals (half away from zero, like Python's display rounding for our values). */
export function round(x: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}
