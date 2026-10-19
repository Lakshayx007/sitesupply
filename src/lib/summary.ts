/**
 * data/stats_summary.json (written by scripts/analysis.py). Used only for results that
 * need Python models (the logistic regression); everything else is computed live from SQL.
 */
import raw from "../../data/stats_summary.json";

export const summary = raw;
