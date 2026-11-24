"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { DailyCount } from "@/lib/admin/overview";

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, CanvasRenderer]);
const dayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const numbers = new Intl.NumberFormat("en");
const formatDay = (day: string) => dayFormat.format(new Date(`${day}T00:00:00Z`));
type ChartProps = { series: DailyCount[] | null; variant: "area" | "bars"; unit?: string; compact?: boolean; label: string };

export function OverviewSparkline({ series, variant, label }: ChartProps) {
  return <Chart series={series} variant={variant} unit="" compact label={label} />;
}

function Chart({ series, variant, unit = "", compact = false, label }: ChartProps) {
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.EChartsType | null>(null);
  useEffect(() => {
    if (!element.current || !series?.length) return;
    const chart = echarts.init(element.current, undefined, { renderer: "canvas" });
    instance.current = chart;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const styles = getComputedStyle(element.current);
    const accent = styles.getPropertyValue("--overview-accent").trim();
    const fill = styles.getPropertyValue("--overview-pink").trim();
    const muted = styles.getPropertyValue("--muted").trim();
    const border = styles.getPropertyValue("--border").trim();
    const option: EChartsOption = {
      animation: !reducedMotion,
      animationDuration: 180,
      grid: compact ? { left: 2, right: 2, top: 5, bottom: 3 } : { left: 38, right: 10, top: 14, bottom: 28 },
      tooltip: compact ? undefined : { trigger: "axis", confine: true, formatter: (items) => {
        const point = Array.isArray(items) ? items[0] : items;
        const index = typeof point?.dataIndex === "number" ? point.dataIndex : 0;
        return `${formatDay(series[index].day)} UTC<br/><strong>${numbers.format(series[index].count)} ${unit}</strong>`;
      } },
      xAxis: { type: "category", data: series.map(point => point.day), boundaryGap: variant === "bars", axisLine: { show: false }, axisTick: { show: false }, axisLabel: compact ? { show: false } : { color: muted, fontSize: 11, hideOverlap: true, formatter: (value: string) => formatDay(value) } },
      yAxis: { type: "value", min: 0, minInterval: 1, splitNumber: 3, axisLine: { show: false }, axisTick: { show: false }, axisLabel: compact ? { show: false } : { color: muted, fontSize: 11, formatter: (value: number) => numbers.format(value) }, splitLine: { show: !compact, lineStyle: { color: border } } },
      series: [{ type: variant === "area" ? "line" : "bar", data: series.map(point => point.count), smooth: false, showSymbol: false,
        lineStyle: { color: accent, width: compact ? 2 : 2.5 },
        areaStyle: variant === "area" ? { color: fill } : undefined,
        itemStyle: { color: accent, borderRadius: variant === "bars" ? [4, 4, 0, 0] : 0 },
        barMaxWidth: 24,
      }],
    };
    chart.setOption(option);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element.current);
    return () => { observer.disconnect(); chart.dispose(); if (instance.current === chart) instance.current = null; };
  }, [series, variant, compact, unit]);

  if (!series) return <span className="text-xs text-muted">Trend unavailable</span>;
  if (series.every(point => point.count === 0)) return compact
    ? <span className="text-xs text-muted">No activity</span>
    : <div className="mt-4 flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted">No {unit} were recorded in this period.</div>;
  return <div ref={element} role="img" aria-label={label} className={compact ? "h-12 w-full min-w-0" : "mt-2 h-52 w-full min-w-0 sm:h-60"} />;
}

export function OverviewChart({ id, title, description, series, variant, empty, unit }: {
  id: string; title: string; description: string; series: DailyCount[] | null;
  variant: "area" | "bars"; empty: string; unit: "registrations" | "reviews";
}) {
  const total = series?.reduce((sum, point) => sum + point.count, 0) ?? 0;
  return <Card padding="sm" className="min-w-0 sm:p-5">
    <CardTitle id={id}>{title}</CardTitle><CardDescription>{description}</CardDescription>
    {!series ? <div className="mt-4 flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted">This chart could not be loaded.</div>
      : total === 0 ? <div className="mt-4 flex min-h-48 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted">{empty}</div>
        : <>
          <p className="my-3 text-sm text-muted"><strong className="mr-1 text-xl font-semibold tabular-nums text-foreground">{numbers.format(total)}</strong>{unit} in period</p>
          <Chart series={series} variant={variant} unit={unit} label={`${title}: ${numbers.format(total)} ${unit} across ${series.length} UTC days`} />
        </>}
  </Card>;
}
