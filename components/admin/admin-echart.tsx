"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, HeatmapChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

echarts.use([BarChart, HeatmapChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

export function AdminEChart({ option, label, height = "h-44 sm:h-52" }: { option: EChartsOption; label: string; height?: string }) {
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.EChartsType | null>(null);

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const chart = instance.current ?? echarts.init(node, undefined, { renderer: "canvas" });
    instance.current = chart;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    chart.setOption({ ...option, animation: !reducedMotion, animationDuration: reducedMotion ? 0 : 180 } as EChartsOption, { notMerge: true });
    const resize = () => {
      if (instance.current === chart && node.clientWidth > 0 && node.clientHeight > 0) {
        chart.resize({ width: node.clientWidth, height: node.clientHeight });
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    window.addEventListener("resize", resize, { passive: true });
    resize();
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, [option]);

  useEffect(() => () => { instance.current?.dispose(); instance.current = null; }, []);
  return <div ref={element} role="img" aria-label={label} className={`w-full min-w-0 ${height}`} />;
}

export function AdminDonut({ value, total, label }: { value: number; total: number; label: string }) {
  const option: EChartsOption = {
    color: ["#F8769C", "#E8DDE1"],
    tooltip: { className: "abii-echart-tooltip", trigger: "item", confine: true, formatter: (item: unknown) => {
      const point = item as { name?: string; value?: number };
      return `${point.name ?? "Population"}: ${new Intl.NumberFormat("en-US").format(point.value ?? 0)}`;
    } },
    series: [{ type: "pie", radius: ["70%", "92%"], avoidLabelOverlap: true, label: { show: false },
      data: [{ name: "Verified", value }, { name: "Not verified within 24 hours", value: Math.max(0, total - value) }] }],
  };
  return <div className="relative size-32 shrink-0"><AdminEChart option={option} label={label} height="h-full" /></div>;
}

export type SparklineUnit = "count" | "milliseconds" | "percent";

export function AdminSparkline({ name, timestamps, values, unit }: {
  name: string;
  timestamps: string[];
  values: (number | null)[];
  unit: SparklineUnit;
}) {
  if (!values.length || values.every(value => value === null)) {
    return <span role="img" aria-label={`${name}: no observations`} className="text-[11px] text-muted">No observations</span>;
  }
  const dateTime = new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: unit === "count" ? 0 : 1 });
  const valueText = (value: number | null) => value === null ? "No observations" :
    `${number.format(value)}${unit === "milliseconds" ? " ms" : unit === "percent" ? "%" : ""}`;
  const option: EChartsOption = {
    color: ["#F8769C"],
    grid: { left: 1, right: 1, top: 3, bottom: 2 },
    tooltip: { className: "abii-echart-tooltip", trigger: "axis", confine: true, formatter: (items: unknown) => {
      const first = (Array.isArray(items) ? items[0] : items) as { dataIndex?: number; value?: number | null } | undefined;
      const index = first?.dataIndex ?? 0;
      const timestamp = timestamps[index];
      return `${timestamp ? `${dateTime.format(new Date(timestamp))} UTC` : "Time unavailable"}<br/>${name}: ${valueText(first?.value ?? null)}`;
    } },
    xAxis: { type: "category", data: timestamps, show: false },
    yAxis: { type: "value", min: 0, show: false },
    series: [{ type: "line", data: values, connectNulls: false, showSymbol: false,
      lineStyle: { color: "#F8769C", width: 2 }, areaStyle: { color: "#FFE8EF", opacity: 0.35 } }],
  };
  return <AdminEChart option={option} label={`${name} by observed interval`} height="h-10" />;
}
