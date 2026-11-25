"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { AdminEmptyState } from "@/components/admin/admin-ui";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { OverviewDonut } from "@/components/admin/overview-chart";
import { type AccountCounts, type DirectoryUser, type UsersPage, type UsersQuery, userSearchLimit, usersHref, usersPath } from "@/lib/admin/users-contract";
import { AccountAvatar, AccountFlags, UserDetailSheet, accountDate, control } from "./admin-user-detail";

const number = new Intl.NumberFormat("en-US");
export function AccountOverview({ counts }: { counts: AccountCounts | null }) {
  const share = counts?.total ? counts.verified / counts.total * 100 : null;
  const pct = (value: number) => counts?.total ? Math.round(value / counts.total * 100) : null;
  return <section aria-labelledby="account-overview">
    <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 id="account-overview" className="text-lg font-bold tracking-tight">Account Overview</h2><p className="text-xs text-muted">Current account snapshot</p></header>
    <div className="grid min-w-0 gap-3 min-[1050px]:grid-cols-12">
      <Card data-overview-feature padding="md" className="grid min-w-0 gap-3 border-transparent bg-[#FFE8EF] min-[1050px]:col-span-5 min-[1050px]:row-span-2">
        <div><h3 className="text-sm font-semibold">Total Users</h3><p className="mt-2 text-4xl font-semibold leading-none tabular-nums">{counts ? number.format(counts.total) : "Unavailable"}</p><p className="mt-2 text-sm text-muted">Registered learner accounts</p></div>
        <div className="flex items-center gap-3 border-t border-[#F8769C]/30 pt-3">
          {share === null ? <p className="grid size-24 shrink-0 place-items-center rounded-full border-[10px] border-border text-xs text-muted">No eligible accounts</p> : <div className="relative"><OverviewDonut value={counts!.verified} total={counts!.total} label={`${Math.round(share)} percent verified; ${counts!.verified} verified of ${counts!.total} accounts`} /><span className="pointer-events-none absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums">{Math.round(share)}%</span></div>}
          <div><p className="text-sm font-semibold">Email verified</p><p className="mt-1 text-xs text-muted">{counts ? `${number.format(counts.verified)} of ${number.format(counts.total)} users` : "Account totals unavailable"}</p></div>
        </div>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 min-[1050px]:col-span-7">
        {counts ? ([ ["Verified Users", counts.verified], ["Unverified Users", counts.unverified] ] as const).map(([label, value]) => <Card key={label} padding="md" className="grid content-between gap-4 shadow-none"><div className="flex items-baseline justify-between gap-2"><h3 className="text-sm font-semibold">{label}</h3><span className="text-xs tabular-nums text-muted">{pct(value) === null ? "—" : `${pct(value)}%`}</span></div><p className="text-3xl font-semibold tabular-nums">{number.format(value)}</p><div className="h-2 overflow-hidden rounded-full bg-[#FFE8EF]"><div className="h-full rounded-full bg-[#F8769C]" style={{ width: `${pct(value) ?? 0}%` }} /></div></Card>) : <Card padding="md" className="sm:col-span-2"><p className="text-sm text-muted">Verification counts are unavailable.</p></Card>}
        <Card padding="md" className="flex items-center justify-between gap-3 shadow-none sm:col-span-2"><div><h3 className="text-sm font-semibold">Suspended Accounts</h3><p className="mt-1 text-xs text-muted">Sign-in restricted</p></div><div className="text-right"><p className="text-3xl font-semibold tabular-nums">{counts ? number.format(counts.suspended) : "Unavailable"}</p><p className="text-xs text-muted">{counts && pct(counts.suspended) !== null ? `${pct(counts.suspended)}% of all accounts` : "Share unavailable"}</p></div></Card>
      </div>
    </div>
    {!counts && <p role="status" className="mt-2 text-sm text-muted">Account totals are temporarily unavailable. Refresh the page to retry.</p>}
  </section>;
}
const fields = [
  { name: "verification", label: "Verification", options: [["all", "All verification"], ["verified", "Verified"], ["unverified", "Unverified"]] },
  { name: "status", label: "Account status", options: [["all", "All statuses"], ["active", "Active"], ["suspended", "Suspended"]] },
] as const;
const sortOptions = [["newest", "Newest first"], ["oldest", "Oldest first"], ["name-asc", "Name A to Z"], ["name-desc", "Name Z to A"]] as const;

function Identity({ user }: { user: DirectoryUser }) {
  return <div className="flex min-w-0 items-center gap-2.5">
    <AccountAvatar name={user.name} profileImage={user.profileImage} />
    <div className="min-w-0">
      <p className="break-words font-semibold [overflow-wrap:anywhere]">{user.name}</p>
      <p className="mt-0.5 break-words text-xs text-muted [overflow-wrap:anywhere]">{user.email || "Email unavailable"}</p>
    </div>
  </div>;
}

export function LearnerDirectory({ query, cursor, page, error }: { query: UsersQuery; cursor?: string; page: UsersPage | null; error: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<DirectoryUser | null>(null);
  const [interactive, setInteractive] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => setInteractive(true), []);
  const filtered = Boolean(query.q || query.verification !== "all" || query.status !== "all");
  const navigate = (href: string) => startTransition(() => router.push(href, { scroll: false }));
  const refresh = () => startTransition(() => router.refresh());
  function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = { q: String(form.get("q")).trim(), verification: form.get("verification"), status: form.get("status"), sort: form.get("sort") } as UsersQuery;
    navigate(usersHref(next));
  }
  function action(user: DirectoryUser) {
    return <button type="button" disabled={!interactive || pending} className={`${control} shrink-0 border-transparent px-2.5 font-semibold text-foreground hover:bg-surface-hover disabled:opacity-55`}
      aria-label={`View details for ${user.name}`} onClick={() => setSelected(user)}>
      Details <ChevronRight size={15} aria-hidden="true" />
    </button>;
  }
  return (
    <section aria-labelledby="learner-directory" className="min-w-0">
      <Card padding="none" className="overflow-hidden shadow-none">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
          <div><h2 ref={heading} tabIndex={-1} id="learner-directory" className="text-lg font-bold tracking-tight">User Directory</h2><p className="mt-0.5 text-xs text-muted">Browse and manage learner accounts.</p></div>
          {page && page.total !== null && <p className="text-sm text-muted tabular-nums">{number.format(page.total)} {page.total === 1 ? "user" : "users"}</p>}
        </header>
        <nav aria-label="Quick account filters" className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5 sm:px-5">
          {([ ["All users", "all", "all"], ["Verified", "verified", "all"], ["Unverified", "unverified", "all"], ["Suspended", "all", "suspended"] ] as const).map(([label, verification, status]) => {
            const href = usersHref({ ...query, verification, status });
            const selectedFilter = query.verification === verification && query.status === status;
            return <Link key={label} href={href} prefetch={false} scroll={false} aria-current={selectedFilter ? "page" : undefined} className={`${control} border-transparent px-3 text-xs font-semibold ${selectedFilter ? "bg-[#FFE8EF] text-[#30262B]" : "text-muted hover:bg-[#FFF1F5]"}`}>{label}</Link>;
          })}
        </nav>
        <form key={usersHref(query)} method="get" action={usersPath} aria-label="Filter learners" onSubmit={onFilter}
          className="flex flex-wrap items-end gap-3 border-b border-border p-4 sm:px-5">
          <label className="grid min-w-0 flex-1 gap-1.5 text-xs font-semibold">
            Search
            <span className="relative">
              <Search aria-hidden="true" size={17} className="pointer-events-none absolute top-3.5 left-3 text-muted" />
              <input className={`${control} w-full pl-9 pr-3 font-normal placeholder:text-muted`} type="search" name="q" maxLength={userSearchLimit}
                defaultValue={query.q} placeholder="Search by name or email" />
            </span>
          </label>
          <details className="group relative">
            <summary className={`${control} flex cursor-pointer list-none items-center justify-center px-3 text-xs font-semibold marker:hidden hover:bg-[#FFF1F5] [&::-webkit-details-marker]:hidden`}>Filters</summary>
            <div className="relative z-10 mt-2 grid w-full gap-3 rounded-xl border border-border bg-[#FFFFFF] p-4 sm:grid-cols-2">
              {fields.map(({ name, label, options }) => <label key={name} className="grid min-w-0 gap-1.5 text-xs font-semibold">{label}
                <select className={`${control} w-full px-2 font-medium`} name={name} defaultValue={query[name]}>{options.map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
              </label>)}
              <div className="flex items-center gap-2 sm:col-span-2">
                <button className={`${control} border-border bg-[#FFE8EF] px-3.5 font-semibold`} disabled={pending}>Apply</button>
                <button type="reset" onClick={() => navigate(usersPath)} className={`${control} border-transparent px-2 text-muted hover:bg-[#FFF1F5]`}>Reset<span className="sr-only"> filters</span></button>
              </div>
            </div>
          </details>
          <label className="grid gap-1 text-xs font-semibold">Sort by
            <select className={`${control} min-w-36 px-2 font-medium`} name="sort" defaultValue={query.sort}>
              {sortOptions.map(([key, value]) => <option key={key} value={key}>{value}</option>)}
            </select>
          </label>
        </form>
        <div aria-busy={pending}>
          {pending && <p role="status" className="border-b border-border bg-surface-hover px-4 py-2 text-xs text-muted sm:px-5">Updating directory…</p>}
          {error ? <div role="alert" className="px-4 py-8 text-error-text sm:px-5">
            <p className="text-sm font-semibold">{error}</p>
            {!page && <button type="button" className={`${control} mt-3 px-3`} onClick={refresh}>Try again</button>}
          </div> : page?.rows.length === 0 ? <div className="px-4 sm:px-5">
            <div className="py-3 md:hidden"><AdminEmptyState size="compact" title={filtered ? "No matching users" : "No users yet"}
              description={filtered ? "Search from the start of a name or email, or reset the filters." : "Learner accounts will appear here after registration."}
              action={filtered ? <Link href={usersPath} prefetch={false} className={`${control} mt-1 px-3`}>Reset filters</Link> : undefined} /></div>
            <table className="hidden w-full table-fixed text-left text-sm md:table">
              <caption className="sr-only">Learner accounts</caption>
              <thead className="border-b border-border bg-[#FFFFFF] text-xs text-[#6F5964]"><tr>
                <th scope="col" className="w-[34%] px-5 py-3 font-semibold">User</th><th scope="col" className="px-2 py-3 font-semibold">Verification</th>
                <th scope="col" className="px-2 py-3 font-semibold">Status</th><th scope="col" className="px-2 py-3 font-semibold">Joined (UTC)</th>
                <th scope="col" className="w-28 px-5 py-3 text-right font-semibold">Actions</th>
              </tr></thead>
              <tbody><tr><td colSpan={5} className="h-40 px-5 text-center"><AdminEmptyState size="compact" title={filtered ? "No matching users" : "No users yet"}
                description={filtered ? "Search from the start of a name or email, or reset the filters." : "Learner accounts will appear here after registration."} /></td></tr></tbody>
            </table>
          </div> : page && <>
            <table className="hidden w-full table-fixed text-left text-sm md:table">
              <caption className="sr-only">Learner accounts</caption>
              <thead className="border-b border-border bg-[#FFFFFF] text-xs text-[#6F5964]">
                <tr>
                  <th scope="col" className="w-[34%] px-5 py-3 font-semibold">User</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Verification</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Joined <span className="font-normal">(UTC)</span></th>
                  <th scope="col" className="w-28 px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {page.rows.map(user => <tr className="hover:bg-[#FFF1F5]/20" key={user.id}>
                  <th scope="row" className="px-5 py-2.5 text-left font-normal"><Identity user={user} /></th>
                  <td className="px-2 py-2"><AccountFlags user={user} kind="verification" /></td>
                  <td className="px-2 py-2"><AccountFlags user={user} kind="status" /></td>
                  <td className="px-2 py-2 text-muted tabular-nums">{accountDate(user.joinedAt)}</td>
                  <td className="px-3 py-2 text-right">{action(user)}</td>
                </tr>)}
              </tbody>
            </table>
            <ul aria-label="Learner accounts" className="divide-y divide-border md:hidden">
              {page.rows.map(user => <li key={user.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2.5 px-4 py-3 text-sm">
                <Identity user={user} />
                {action(user)}
                <div className="col-span-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-0.5">
                  <AccountFlags user={user} kind="verification" /><AccountFlags user={user} kind="status" />
                  <span className="ml-auto text-xs text-muted">{user.joinedAt ? `Joined ${accountDate(user.joinedAt)} UTC` : "Join date unavailable"}</span>
                </div>
              </li>)}
            </ul>
            <footer className="px-4 py-3 sm:px-5">
              <AdminPagination label="Directory pagination" result={page.start !== null && page.total !== null && page.start + page.rows.length - 1 <= page.total
                ? `Showing ${number.format(page.start)}–${number.format(page.start + page.rows.length - 1)} of ${number.format(page.total)}`
                : `Showing ${page.rows.length} users on this page`}>
                {([["Previous", page.previous, ChevronLeft], ["Next", page.next, ChevronRight]] as const).map(([label, token, Icon]) => {
                  const content = <>{label === "Previous" && <Icon size={15} aria-hidden="true" />}{label}{label === "Next" && <Icon size={15} aria-hidden="true" />}</>;
                  const href = usersHref(query, token);
                  return token && !pending
                    ? <Link key={label} href={href} prefetch={false} scroll={false} className={`${control} px-2.5 hover:bg-pink-soft`}
                      onNavigate={event => { event.preventDefault(); navigate(href); }}>{content}</Link>
                    : <button key={label} type="button" disabled className={`${control} px-2.5 opacity-45`}>{content}</button>;
                })}
              </AdminPagination>
            </footer>
          </>}
        </div>
      </Card>
      {selected && <UserDetailSheet user={selected} onClose={() => setSelected(null)} onRefresh={refresh}
        onChanged={() => {
          // A confirmed change can remove the account from a filtered cursor page.
          if (cursor && query.status !== "all" && page?.rows.length === 1) navigate(usersHref(query));
          else refresh();
        }} fallbackFocus={heading} />}
    </section>
  );
}
