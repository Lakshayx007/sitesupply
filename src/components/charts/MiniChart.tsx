import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts } from "./echarts";

const css = (v: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(v).trim().split(" ").join(",")})`;

/** One-series bar or line chart in the SiteSupply style: 2px lines, rounded bar ends, faint grid, tooltips. */
export function MiniChart({
  type,
  labels,
  values,
  name,
  height = 260,
  highlight,
}: {
  type: "bar" | "line";
  labels: string[];
  values: number[];
  name: string;
  height?: number;
  highlight?: (label: string) => boolean;
}) {
  const ink = css("--primary-ink");
  const muted = css("--muted");
  const grid = css("--line");
  const accent = css("--accent");
  const option = {
    animationDuration: 500,
    grid: { left: 8, right: 12, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: css("--overlay"),
      borderColor: css("--line-strong"),
      textStyle: { color: css("--ink"), fontFamily: "Inter, sans-serif", fontSize: 12 },
      axisPointer: { type: type === "bar" ? "shadow" : "line", lineStyle: { color: grid }, shadowStyle: { color: "rgba(255,255,255,0.03)" } },
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLine: { lineStyle: { color: grid } },
      axisTick: { show: false },
      axisLabel: { color: muted, fontSize: 11, hideOverlap: true, interval: "auto" },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: grid } },
      axisLabel: { color: muted, fontSize: 11 },
    },
    series: [
      type === "bar"
        ? {
            type: "bar",
            name,
            data: values.map((v, i) => ({ value: v, itemStyle: { color: highlight?.(labels[i]) ? accent : ink } })),
            barMaxWidth: 28,
            itemStyle: { borderRadius: [4, 4, 0, 0] },
          }
        : {
            type: "line",
            name,
            data: values,
            smooth: false,
            showSymbol: values.length < 30,
            symbolSize: 5,
            lineStyle: { width: 2, color: ink },
            itemStyle: { color: ink },
            areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: ink.replace("rgb", "rgba").replace(")", ",0.18)") }, { offset: 1, color: "rgba(0,0,0,0)" }] } },
          },
    ],
  };
  return <ReactEChartsCore echarts={echarts} option={option} style={{ height, width: "100%" }} notMerge opts={{ renderer: "canvas" }} />;
}
