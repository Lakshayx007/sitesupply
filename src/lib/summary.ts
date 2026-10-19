/**
 * data/stats_summary.json (written by scripts/analysis.py). Numbers that are not
 * computed live from SQL on the site come from here, never from hand-typed values.
 */
import raw from "../../data/stats_summary.json";

export const summary = raw;
export type Summary = typeof raw;
