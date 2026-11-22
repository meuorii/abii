"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";

type Series = { label: string; color: string; values: number[] };
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const numbers = new Intl.NumberFormat("en-US");
const axisNumbers = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const width = 600;
const height = 152;
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B3054]";

export function AnalyticsChart({ title, days, series, kind, empty }: {
  title: string; days: string[]; series: Series[]; kind: "area" | "bars"; empty: string;
}) {
  const [selected, setSelected] = useState<number>();
  const id = useId();
  const totals = days.map((_, index) => series.reduce((sum, track) => sum + track.values[index], 0));
  const highest = Math.max(0, ...totals);
  if (highest === 0) return <p className="mt-4 grid min-h-32 place-items-center rounded-xl border border-dashed border-border px-4 text-center text-sm text-muted">{empty}</p>;

  const steps = Math.min(4, highest);
  const step = Math.ceil(highest / steps);
  const tick = (value: number) => value < 10_000 ? numbers.format(value) : axisNumbers.format(value);
  const last = days.length - 1;
  const barWidth = Math.min(36, (width / days.length) * 0.68);
  const inset = kind === "bars" ? width / days.length / 2 : 4;
  const x = (index: number) => inset + index * (width - 2 * inset) / Math.max(1, last);
  const y = (value: number) => height - 2 - value * (height - 7) / (step * steps);
  const points = series[0].values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const day = (index: number) => dateFormat.format(new Date(days[index]));
  const getValue = (index: number) => series.map(track => `${track.label} ${numbers.format(track.values[index])}`).join(", ");
  function locate(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = (event.clientX - bounds.left) / bounds.width * width;
    setSelected(Math.max(0, Math.min(last, Math.round((position - inset) / (width - inset * 2) * last))));
  }
  function inspect(event: KeyboardEvent<HTMLDivElement>) {
    const current = selected ?? 0;
    const values: Record<string, number> = { ArrowRight: current + 1, ArrowUp: current + 1, ArrowLeft: current - 1,
      ArrowDown: current - 1, Home: 0, End: last };
    if (!(event.key in values)) return;
    event.preventDefault();
    setSelected(Math.max(0, Math.min(last, values[event.key])));
  }

  return (
    <div className="mt-3 min-w-0">
      <p aria-hidden="true" className="mb-2 min-h-6 text-xs leading-5 font-semibold text-[#853750]">
        {selected === undefined ? <span className="font-medium text-muted">Select a day to inspect values.</span> : `${day(selected)} UTC · ${getValue(selected)}`}
      </p>
      <p id={id} className="sr-only">{day(0)} to {day(last)} UTC. Inspect daily values with the arrow keys. Home and End jump to the start and end.</p>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5">
        <div aria-hidden="true" className="flex flex-col justify-between py-0.5 text-right text-xs text-muted tabular-nums">
          {Array.from({ length: steps + 1 }, (_, index) => <span key={index}>{tick((steps - index) * step)}</span>)}
        </div>
        <div role="slider" aria-label={`${title} daily values`} aria-describedby={id} aria-valuemin={1} aria-valuemax={days.length}
          aria-valuenow={(selected ?? 0) + 1} aria-valuetext={`${day(selected ?? 0)} UTC, ${getValue(selected ?? 0)}`}
          tabIndex={0} onFocus={() => setSelected(index => index ?? 0)} onBlur={() => setSelected(undefined)}
          onKeyDown={inspect} onPointerDown={locate} onPointerMove={event => { if (event.pointerType === "mouse") locate(event); }}
          onPointerLeave={event => { if (document.activeElement !== event.currentTarget) setSelected(undefined); }}
          className={`h-36 min-w-0 cursor-crosshair rounded-sm sm:h-44 ${focus}`}>
          <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="size-full">
            {Array.from({ length: steps + 1 }, (_, index) => <line key={index} x1={0} x2={width} y1={y(index * step)} y2={y(index * step)}
              stroke="#E9DFE4" vectorEffect="non-scaling-stroke" />)}
            {kind === "area" ? <>
              <polygon points={`${x(0)},${y(0)} ${points} ${x(last)},${y(0)}`} fill={series[0].color} opacity="0.12" />
              <polyline points={points} fill="none" stroke={series[0].color} strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </> : days.map((date, index) => {
              let base = 0;
              return <g key={date} opacity={selected === undefined || selected === index ? 1 : 0.67}>
                {series.map(track => {
                  const bottom = y(base);
                  base += track.values[index];
                  return <rect key={track.label} x={x(index) - barWidth / 2} y={y(base)} width={barWidth} height={bottom - y(base)} fill={track.color} />;
                })}
              </g>;
            })}
            {selected !== undefined && <line x1={x(selected)} x2={x(selected)} y1={4} y2={y(0)} stroke="#853750" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          </svg>
        </div>
        <div aria-hidden="true" className="col-start-2 mt-2 flex justify-between gap-2 text-xs text-muted">
          {[0, Math.floor(last / 2), last].map(index => <span key={index}>{day(index)}</span>)}
        </div>
      </div>
      <details className="mt-3 border-t border-border">
        <summary className={`min-h-11 cursor-pointer rounded py-3 text-xs font-semibold text-[#744455] ${focus}`}>View daily data</summary>
        <div role="region" tabIndex={0} aria-label={`${title} data table`} className={`max-h-52 overflow-auto rounded border border-border ${focus}`}>
          <table className="w-full text-left text-xs tabular-nums">
            <caption className="sr-only">{title} by UTC day</caption>
            <thead className="bg-pink-soft"><tr><th scope="col" className="p-2.5">UTC date</th>{series.map(track =>
              <th key={track.label} scope="col" className="p-2.5 text-right">{track.label}</th>)}</tr></thead>
            <tbody>{days.map((date, index) => <tr key={date} className="border-t border-border">
              <th scope="row" className="p-2.5 font-medium whitespace-nowrap">{day(index)}</th>
              {series.map(track => <td key={track.label} className="p-2.5 text-right">{numbers.format(track.values[index])}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
