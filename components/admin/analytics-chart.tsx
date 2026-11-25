"use client";

import { useId, useState, type KeyboardEvent } from "react";
import type { EChartsOption } from "echarts";
import { AdminEChart } from "./admin-echart";
import { AdminEmptyState } from "./admin-ui";

type Series = { label: string; color: string; values: (number | null)[]; dash?: string; area?: boolean };
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const numbers = new Intl.NumberFormat("en-US");
const axisNumbers = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B3054]";

export function AnalyticsChart({ title, days, series, kind, empty, intervals, unit, sampleCounts, categories, categoryName = "day", horizontal = false, stacked = kind === "bars" }: {
  title: string; days: string[]; series: Series[]; kind: "area" | "bars" | "lines"; empty: string;
  intervals?: { label: string; tick: string; open?: boolean }[]; unit?: string; sampleCounts?: number[]; categories?: string[]; categoryName?: string; horizontal?: boolean; stacked?: boolean;
}) {
  const [selected, setSelected] = useState<number>();
  const id = useId();
  const totals = days.map((_, index) => series.reduce((sum, track) => sum + (track.values[index] ?? 0), 0));
  const highest = Math.max(0, ...(kind === "lines" ? series.flatMap(track => track.values.map(value => value ?? 0)) : totals));
  if (highest === 0) return <div className="mt-3 flex min-h-[220px] flex-1 flex-col sm:min-h-[240px]"><AdminEmptyState title={empty} size="visualization" /></div>;
  const last = days.length - 1;
  const day = (index: number) => categories?.[index] ?? intervals?.[index]?.label ?? dateFormat.format(new Date(days[index]));
  const tickLabel = (index: number) => intervals?.[index]?.tick ?? categories?.[index] ?? day(index);
  const timestamp = (index: number) => categories ? day(index) : intervals ? day(index) : `${day(index)} UTC`;
  const formatValue = (value: number | null) => value === null ? "unavailable" : numbers.format(value) + (unit ? ` ${unit}` : "");
  const getValue = (index: number) => series.map(track => `${track.label} ${formatValue(track.values[index])}`).join(", ") + (sampleCounts ? `, ${numbers.format(sampleCounts[index])} ${sampleCounts[index] === 1 ? "sample" : "samples"}` : "");
  function inspect(event: KeyboardEvent<HTMLDivElement>) {
    const current = selected ?? 0;
    const values: Record<string, number> = { ArrowRight: current + 1, ArrowUp: current + 1, ArrowLeft: current - 1,
      ArrowDown: current - 1, Home: 0, End: last };
    if (!(event.key in values)) return;
    event.preventDefault();
    setSelected(Math.max(0, Math.min(last, values[event.key])));
  }
  const option: EChartsOption = {
    color: ["#F8769C", "#FFDBED", "#F8769C"],
    grid: { left: 42, right: 10, top: series.length > 1 ? 30 : 12, bottom: 30, containLabel: false },
    legend: series.length > 1 ? { top: 0, left: 0, textStyle: { color: "#66565F", fontSize: 11 } } : undefined,
    tooltip: { className: "abii-echart-tooltip", trigger: "axis", confine: true, axisPointer: { type: "line" },
      formatter: (params: unknown) => {
        const values = Array.isArray(params) ? params : [params];
        const first = values[0] as { dataIndex?: number } | undefined;
        const index = Math.max(0, Math.min(last, first?.dataIndex ?? 0));
        return `${day(index)}${categories ? "" : " UTC"}<br/>${series.map(track => `${track.label}: ${formatValue(track.values[index])}`).join("<br/>")}${sampleCounts ? `<br/>${numbers.format(sampleCounts[index])} samples` : ""}`;
      } },
    xAxis: horizontal ? { type: "value", min: 0, minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#66565F", fontSize: 10, formatter: (value: number) => `${axisNumbers.format(value)}${unit ? ` ${unit}` : ""}` }, splitLine: { lineStyle: { color: "#FFDBED" } } } :
      { type: "category", data: days.map((value, index) => categories?.[index] ?? intervals?.[index]?.tick ?? dateFormat.format(new Date(value))), boundaryGap: kind === "bars", axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#66565F", fontSize: 10, hideOverlap: true, interval: "auto" } },
    yAxis: horizontal ? { type: "category", data: days.map((value, index) => categories?.[index] ?? intervals?.[index]?.tick ?? dateFormat.format(new Date(value))), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#66565F", fontSize: 11 } } :
      { type: "value", min: 0, minInterval: 1, splitNumber: 3, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: "#66565F", fontSize: 10, formatter: (value: number) => `${axisNumbers.format(value)}${unit ? ` ${unit}` : ""}` }, splitLine: { lineStyle: { color: "#FFDBED" } } },
    series: series.map((track, index) => ({ name: track.label, type: kind === "bars" ? "bar" : "line", data: track.values,
      stack: kind === "bars" && stacked ? "outcomes" : undefined, showSymbol: false, connectNulls: false,
      lineStyle: { color: track.color, width: index === 0 ? 2.5 : 2, type: track.dash?.startsWith("1") ? "dotted" : track.dash ? "dashed" : "solid" },
      areaStyle: kind === "area" || track.area ? { color: track.color, opacity: 0.22 } : undefined,
      itemStyle: track.label === "Unknown outcome" || track.label === "4xx" ? { color: "#FFF9FC", borderColor: "#F8769C", borderWidth: 1,
        decal: { symbol: "rect", symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [3, 3], color: "#F8769C" } } : { color: track.color },
      barMaxWidth: horizontal ? 18 : 24,
    })) as EChartsOption["series"],
  };

  return (
    <div className="relative mt-3 flex min-h-[220px] min-w-0 flex-1 flex-col sm:min-h-[240px]">
      <p aria-hidden="true" className="mb-2 min-h-6 text-xs leading-5 font-semibold text-[#853750]">
        {selected === undefined ? <span className="font-medium text-muted">Select {intervals ? "an interval" : "a day"} to inspect values.</span> : `${timestamp(selected)} · ${getValue(selected)}`}
      </p>
      <p id={id} className="sr-only">{categories ? "" : intervals ? "" : `${day(0)} to ${day(last)} UTC. `}Inspect {categories ? categoryName : intervals ? "interval" : "daily"} values with the arrow keys. Home and End jump to the start and end.</p>
      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
        <div role="slider" aria-label={`${title} ${intervals ? "interval" : "daily"} values`} aria-describedby={id} aria-valuemin={1} aria-valuemax={days.length}
          aria-valuenow={(selected ?? 0) + 1} aria-valuetext={`${timestamp(selected ?? 0)}, ${getValue(selected ?? 0)}`}
          tabIndex={0} onFocus={() => setSelected(index => index ?? 0)} onBlur={() => setSelected(undefined)} onKeyDown={inspect}
          className={`block h-full min-h-36 min-w-0 cursor-crosshair rounded-sm sm:min-h-44 ${focus}`}>
          <AdminEChart option={option} label={`${title}, ${days.length} ${intervals ? "intervals" : "days"}; use arrow keys to inspect values`} height="h-full" />
        </div>
        <div aria-hidden="true" className="mt-2 flex justify-between gap-2 text-xs text-muted">
          {[...new Set([0, Math.floor(last / 2), last])].map(index => <span key={index}>{tickLabel(index)}</span>)}
        </div>
      </div>
    </div>
  );
}
