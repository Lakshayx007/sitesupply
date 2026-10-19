/** Small option builders so simple charts look the same everywhere. */
import { base, tok } from "./echarts";

const pctFmt = (v: number) => `${Math.round(v * 1000) / 10}%`;

export function barsV(labels: string[], values: number[], opts: { percent?: boolean; max?: number; suffix?: string } = {}) {
  const B = base();
  const f = (v: number) => (opts.percent ? pctFmt(v) : `${v.toLocaleString("en-US")}${opts.suffix ?? ""}`);
  return {
    ...B,
    tooltip: { ...B.tooltip, axisPointer: { type: "shadow" }, valueFormatter: f },
    xAxis: { type: "category", data: labels, ...B.axisCommon, splitLine: { show: false }, axisLabel: { ...B.axisCommon.axisLabel, color: tok("ink-2"), interval: 0 } },
    yAxis: {
      type: "value",
      max: opts.max,
      ...B.axisCommon,
      axisLabel: { ...B.axisCommon.axisLabel, formatter: (v: number) => (opts.percent ? `${Math.round(v * 100)}%` : String(v)) },
    },
    series: [
      {
        type: "bar",
        data: values,
        barMaxWidth: 56,
        itemStyle: { color: B.series1, borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: "top", color: tok("ink"), fontSize: 12, formatter: (p: { value: number }) => f(p.value) },
      },
    ],
  };
}

export function barsH(labels: string[], values: number[], opts: { percent?: boolean; suffix?: string; extra?: (string | null)[] } = {}) {
  const B = base();
  const f = (v: number) => (opts.percent ? pctFmt(v) : `${v.toLocaleString("en-US")}${opts.suffix ?? ""}`);
  const rl = [...labels].reverse();
  const rv = [...values].reverse();
  const re = opts.extra ? [...opts.extra].reverse() : null;
  return {
    ...B,
    grid: { ...B.grid, right: 72 },
    tooltip: { ...B.tooltip, axisPointer: { type: "shadow" }, valueFormatter: f },
    xAxis: { type: "value", ...B.axisCommon, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: { type: "category", data: rl, ...B.axisCommon, axisLabel: { ...B.axisCommon.axisLabel, color: tok("ink-2") } },
    series: [
      {
        type: "bar",
        data: rv.map((v, i) => ({ value: v, extra: re?.[i] ?? null })),
        barWidth: 16,
        itemStyle: { color: B.series1, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: "right",
          color: tok("ink-2"),
          fontSize: 11,
          formatter: (p: { value: number; data: { extra: string | null } }) => (p.data.extra ? `${f(p.value)}  ${p.data.extra}` : f(p.value)),
        },
      },
    ],
  };
}

export function lines(
  labels: string[],
  series: { name: string; values: number[] }[],
  opts: { percent?: boolean; min?: number; max?: number; xName?: string; markX?: { at: string; label: string }[]; markY?: { at: number; label: string } } = {},
) {
  const B = base();
  const colors = [B.series1, B.series2];
  return {
    ...B,
    legend: series.length > 1 ? { show: true, top: 0, right: 0, textStyle: { color: B.muted, fontSize: 11 }, itemWidth: 14, itemHeight: 2 } : { show: false },
    grid: { ...B.grid, top: series.length > 1 ? 32 : 24, bottom: opts.xName ? 24 : 8 },
    tooltip: { ...B.tooltip, valueFormatter: (v: number) => (opts.percent ? pctFmt(v) : v.toLocaleString("en-US")) },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      name: opts.xName,
      nameLocation: "middle",
      nameGap: 26,
      ...B.axisCommon,
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      min: opts.min,
      max: opts.max,
      ...B.axisCommon,
      axisLabel: { ...B.axisCommon.axisLabel, formatter: (v: number) => (opts.percent ? `${Math.round(v * 100)}%` : v.toLocaleString("en-US")) },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: "line",
      data: s.values,
      symbolSize: 5,
      lineStyle: { width: 2, color: colors[i % 2] },
      itemStyle: { color: colors[i % 2] },
      markLine:
        i === 0 && (opts.markX || opts.markY)
          ? {
              silent: true,
              symbol: "none",
              lineStyle: { color: B.series2, type: "dashed", width: 1 },
              label: { color: B.muted, fontSize: 11 },
              data: [
                ...(opts.markX ?? []).map((m) => ({ xAxis: m.at, label: { formatter: m.label, color: B.muted, fontSize: 11 } })),
                ...(opts.markY ? [{ yAxis: opts.markY.at, label: { formatter: opts.markY.label, color: B.muted, fontSize: 11, position: "insideEndTop" } }] : []),
              ],
            }
          : undefined,
    })),
  };
}
