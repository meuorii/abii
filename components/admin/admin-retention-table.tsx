"use client";

import { useState } from "react";
import type { RetentionCohort } from "@/lib/admin/analytics-contract";
import { AdminPagination } from "./admin-pagination";

const pageSize = 10;
const number = new Intl.NumberFormat("en-US");
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const horizons = [1, 7, 30] as const;
const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-[#FFFFFF] px-3 text-xs font-semibold text-[#30262B] hover:bg-[#FFF1F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F8769C] disabled:cursor-not-allowed disabled:opacity-45";

export function AdminRetentionTable({ cohorts, cohortDateLabels }: { cohorts: RetentionCohort[]; cohortDateLabels: string[] }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(cohorts.length / pageSize);
  const first = page * pageSize;
  const visible = cohorts.slice(first, first + pageSize);
  const last = first + visible.length;
  return <>
    <div role="region" aria-label="Retention cohort matrix" tabIndex={0} className="relative mt-3 max-h-72 overflow-auto rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-[#EC658D]">
      <table className="w-full min-w-[220px] table-fixed text-left text-xs">
        <caption className="sr-only">Weekly signup cohorts with returned and eligible counts for days 1, 7 and 30</caption>
        <thead className="sticky top-0 bg-[#FFFFFF] text-muted"><tr>
          <th scope="col" className="px-2 py-2 max-sm:w-[27%]">Signup dates</th><th scope="col" className="px-1.5 py-2 max-sm:w-[18%]">Signups</th>
          {horizons.map(horizon => <th key={horizon} scope="col" className="px-2 py-2">D{horizon}</th>)}
        </tr></thead>
        <tbody>{visible.map((cohort, index) => <tr key={cohort.start} className="border-t border-border">
          <th scope="row" className="px-2 py-1.5 font-semibold sm:whitespace-nowrap">{cohortDateLabels[first + index]}</th>
          <td className="px-1.5 py-1.5 tabular-nums">{number.format(cohort.size)}</td>
          {horizons.map(horizon => {
            const value = cohort.rates[horizon];
            const measured = value.eligible ? value.counted / value.eligible : null;
            const opacity = measured === null ? 0 : 22 + Math.round(measured * 0.58);
            return <td key={horizon} className="px-1 py-1.5"><div style={{ backgroundColor: measured === null ? "#FFFFFF" : `color-mix(in srgb, #F8769C ${opacity}%, #FFE8EF)` }} className="rounded-md px-1 py-1.5 leading-4 tabular-nums text-[#30262B] [overflow-wrap:anywhere] sm:px-2">
              {measured === null ? <span aria-label="Return day has yet to end">—</span> : <><span className="block font-bold">{percent.format(measured)}</span><span className="block text-[11px]">{number.format(value.counted)}/{number.format(value.eligible)}</span></>}
            </div></td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
    {pageCount > 1 && <AdminPagination label="Retention cohort pages" result={`Showing ${first + 1}–${last} of ${number.format(cohorts.length)} cohorts · Page ${page + 1} of ${pageCount}`}>
      <button type="button" className={button} disabled={page === 0} onClick={() => setPage(current => Math.max(0, current - 1))}>Previous</button>
      <button type="button" className={button} disabled={page + 1 === pageCount} onClick={() => setPage(current => Math.min(pageCount - 1, current + 1))}>Next</button>
    </AdminPagination>}
  </>;
}
