/** ECharts, registered once with only the parts SiteSupply uses, plus theme helpers read from the CSS tokens. */
import { BarChart, LineChart, ScatterChart, CustomChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  CustomChart,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export { echarts };

/** "R G B" CSS variable → "rgb(r,g,b)" or "rgba(r,g,b,a)". */
export function tok(name: string, alpha?: number): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim().split(/\s+/).join(",");
  return alpha === undefined ? `rgb(${v})` : `rgba(${v},${alpha})`;
}

/** Shared look: faint grid, muted axis labels, dark tooltip, Inter. */
export function base() {
  const muted = tok("muted");
  const gridColor = tok("line");
  return {
    animationDuration: 500,
    textStyle: { fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: tok("overlay"),
      borderColor: tok("line-strong"),
      textStyle: { color: tok("ink"), fontSize: 12 },
      axisPointer: { lineStyle: { color: tok("line-strong") }, shadowStyle: { color: "rgba(255,255,255,0.03)" } },
    },
    axisCommon: {
      axisLine: { lineStyle: { color: gridColor } },
      axisTick: { show: false },
      axisLabel: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: gridColor } },
      nameTextStyle: { color: muted, fontSize: 11 },
    },
    series1: tok("primary-ink"),
    series2: tok("ink-2"),
    muted,
  };
}
