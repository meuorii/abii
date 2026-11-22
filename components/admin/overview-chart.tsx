"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { DailyCount } from "@/lib/admin/overview";

const dayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const numbers = new Intl.NumberFormat("en");
const axisNumbers = new Intl.NumberFormat("en", { notation: "compact" });
const formatDay = (day: string) => dayFormat.format(new Date(day));
const countUnit = (count: number, plural: string) => count === 1 ? plural.slice(0, -1) : plural;
const width = 600;
const height = 160;
const inset = 5;

export function OverviewChart({ id, title, description, series, variant, empty, unit }: {
  id: string; title: string; description: string; series: DailyCount[] | null;
  variant: "area" | "bars"; empty: string; unit: "registrations" | "reviews";
}) {
  const [index, setIndex] = useState<number>();
  const total = series?.reduce((sum, point) => sum + point.count, 0) ?? 0;
  const populated = series && total !== 0;
  const active = index === undefined ? undefined : series?.[index];
  const maximum = Math.max(1, ...(series?.map(point => point.count) ?? []));
  const steps = Math.min(4, maximum);
  const step = Math.ceil(maximum / steps);
  const last = (series?.length ?? 1) - 1;
  const barWidth = Math.min(32, (width - 2 * inset) / (last + 1) * 0.62);
  const edge = variant === "bars" ? barWidth / 2 + inset : inset;
  const x = (point: number) => edge + point * (width - edge * 2) / Math.max(1, last);
  const y = (value: number) => height - value * (height - inset) / (step * steps);
  const line = series?.map((point, i) => `${x(i)},${y(point.count)}`).join(" ");

  function selectPoint(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const chartX = (event.clientX - bounds.left) / bounds.width * width;
    setIndex(Math.round(Math.max(0, Math.min(1, (chartX - edge) / (width - 2 * edge))) * last));
  }

  function movePoint(event: KeyboardEvent<HTMLDivElement>) {
    const current = index ?? 0;
    const stepsByKey: Partial<Record<string, number>> = { ArrowRight: current + 1, ArrowUp: current + 1, ArrowLeft: current - 1,
      ArrowDown: current - 1, Home: 0, End: last };
    const next = stepsByKey[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setIndex(Math.max(0, Math.min(last, next)));
  }

  return (
    <Card padding="sm" className="min-w-0 sm:p-5">
      <CardTitle id={id}>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      {!populated ? (
        <div className="mt-4 flex min-h-52 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-sm text-muted">
          {series ? empty : "This chart could not be loaded."}
        </div>
      ) : (
        <>
          <div className="my-4 flex min-h-12 flex-wrap items-baseline justify-between gap-x-3 text-sm text-muted sm:min-h-8">
            <p><strong className="mr-1 text-xl font-semibold tabular-nums text-foreground">{numbers.format(total)}</strong> {countUnit(total, unit)} in period</p>
            {active && <p className="font-medium tabular-nums text-[#9B3054]">{formatDay(active.day)} · {numbers.format(active.count)}</p>}
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
            <div aria-hidden="true" className="flex flex-col justify-between text-right text-xs tabular-nums text-muted">
              {Array.from({ length: steps + 1 }, (_, i) => <span key={i}>{axisNumbers.format((steps - i) * step)}</span>)}
            </div>
            <div role="slider" aria-labelledby={id} aria-valuemin={1} aria-valuemax={last + 1}
              aria-valuenow={(index ?? 0) + 1} aria-valuetext={`${formatDay((active ?? series[0]).day)} UTC, ${(active ?? series[0]).count} ${countUnit((active ?? series[0]).count, unit)}`}
              tabIndex={0} onFocus={() => setIndex(old => old ?? 0)} onBlur={() => setIndex(undefined)}
              onKeyDown={movePoint} onPointerDown={selectPoint}
              onPointerMove={event => { if (event.pointerType === "mouse") selectPoint(event); }}
              onPointerLeave={event => { if (document.activeElement !== event.currentTarget && event.pointerType === "mouse") setIndex(undefined); }}
              className="h-36 min-w-0 cursor-crosshair rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B3054] sm:h-44">
              <svg aria-hidden="true" viewBox={`0 0 ${width} ${height + 1}`} preserveAspectRatio="none" className="size-full">
                {Array.from({ length: steps + 1 }, (_, i) => (
                  <line key={i} x1={0} x2={width} y1={y(i * step)} y2={y(i * step)} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
                ))}
                {variant === "area" ? <>
                  <polygon points={`${x(0)},${height} ${line} ${x(last)},${height}`} fill="var(--pink-card)" />
                  <polyline points={line} fill="none" stroke="#D34D75" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </> : series.map((point, i) => (
                  <rect key={point.day} x={x(i) - barWidth / 2} y={y(point.count)} width={barWidth} height={height - y(point.count)}
                    fill={index === i ? "#9B3054" : "#D34D75"} />
                ))}
                {index !== undefined && <line x1={x(index)} x2={x(index)} y1={inset} y2={height} stroke="#9B3054" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
              </svg>
            </div>
            <div aria-hidden="true" className="col-start-2 mt-2 flex justify-between gap-2 text-xs text-muted">
              {[0, Math.floor(last / 2), last].map(i => <span key={i}>{formatDay(series[i].day)}</span>)}
            </div>
          </div>
          <details className="mt-3 border-t border-border pt-1">
            <summary className="min-h-11 cursor-pointer rounded px-1 py-3 text-sm font-medium text-muted focus-visible:outline-2 focus-visible:outline-[#9B3054]">View daily counts</summary>
            <div className="max-h-48 overflow-auto" role="region" aria-label={title + " daily counts"} tabIndex={0}>
              <table className="w-full text-left text-sm tabular-nums">
                <caption className="sr-only">{title} daily counts in UTC</caption>
                <thead><tr><th scope="col" className="p-2">UTC date</th><th scope="col" className="p-2 text-right">Count</th></tr></thead>
                <tbody>{series.map(point => <tr key={point.day} className="border-t border-border">
                  <th scope="row" className="p-2 font-normal">{formatDay(point.day)}</th><td className="p-2 text-right">{numbers.format(point.count)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </Card>
  );
}
