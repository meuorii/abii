"use client";

import { BadgeCheck, ChevronLeft, ChevronRight, CircleSlash2, Mail, Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { type AccountCounts, type DirectoryUser, type UsersPage, type UsersQuery, userSearchLimit, usersHref, usersPath } from "@/lib/admin/users-contract";
import { AccountAvatar, AccountFlags, UserDetailSheet, accountDate, control } from "./admin-user-detail";

const number = new Intl.NumberFormat("en-US");
const stats = [
  { key: "total", label: "Total Users", caption: "All learner accounts", Icon: Users, tone: "text-[#91314E]" },
  { key: "verified", label: "Verified Accounts", caption: "Email confirmed", Icon: BadgeCheck, tone: "text-[#256047]" },
  { key: "unverified", label: "Unverified Accounts", caption: "Awaiting email verification", Icon: Mail, tone: "text-muted" },
  { key: "suspended", label: "Suspended Accounts", caption: "Sign-in blocked", Icon: CircleSlash2, tone: "text-[#91314E]" },
] as const;

export function AccountOverview({ counts }: { counts: AccountCounts | null }) {
  return (
    <section aria-labelledby="account-overview">
      <h2 id="account-overview" className="mb-3 text-lg font-bold tracking-tight">Account overview</h2>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {stats.map(({ key, label, caption, Icon, tone }) => (
          <Card key={key} padding="none" className="min-w-0 px-3 py-3.5 shadow-none sm:p-4">
            <div className="flex items-start justify-between gap-1.5">
              <h3 className="text-[13px] font-semibold leading-5 sm:text-sm">{label}</h3>
              <Icon aria-hidden="true" size={17} className={`mt-0.5 shrink-0 ${tone}`} />
            </div>
            <p className="mt-1.5 text-[1.65rem] leading-none font-bold tracking-tight tabular-nums sm:text-[2rem]">{counts ? number.format(counts[key]) : <span aria-label="Unavailable">–</span>}</p>
            <p className="mt-2 text-xs leading-4.5 text-muted">{caption}</p>
          </Card>
        ))}
      </div>
      {!counts && <p role="status" className="mt-2 text-sm text-muted">Account totals are temporarily unavailable. Refresh the page to retry.</p>}
    </section>
  );
}

const fields = [
  { name: "verification", label: "Verification", options: [["all", "All verification"], ["verified", "Verified"], ["unverified", "Unverified"]] },
  { name: "status", label: "Account status", options: [["all", "All statuses"], ["active", "Active"], ["suspended", "Suspended"]] },
  { name: "sort", label: "Sort by", options: [["newest", "Newest joined"], ["oldest", "Oldest joined"], ["name-asc", "Name A to Z"], ["name-desc", "Name Z to A"]] },
] as const;

function Identity({ user }: { user: DirectoryUser }) {
  return <div className="flex min-w-0 items-center gap-2.5">
    <AccountAvatar name={user.name} />
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
    return <button type="button" disabled={!interactive || pending} className={`${control} shrink-0 border-transparent px-2.5 font-semibold text-[#91314E] hover:bg-pink-soft disabled:opacity-55`}
      aria-label={`View details for ${user.name}`} onClick={() => setSelected(user)}>
      Details <ChevronRight size={15} aria-hidden="true" />
    </button>;
  }
  return (
    <section aria-labelledby="learner-directory" className="min-w-0">
      <Card padding="none" className="overflow-hidden shadow-none">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
          <h2 ref={heading} tabIndex={-1} id="learner-directory" className="text-lg font-bold tracking-tight">Learner directory</h2>
          {page && page.total !== null && <p className="text-sm text-muted tabular-nums">{number.format(page.total)} {page.total === 1 ? "user" : "users"}</p>}
        </header>
        <form key={usersHref(query)} method="get" action={usersPath} aria-label="Filter learners" onSubmit={onFilter}
          className="grid gap-3 border-b border-border p-4 sm:px-5 xl:flex xl:items-end">
          <label className="grid min-w-0 flex-1 gap-1.5 text-xs font-semibold">
            Search
            <span className="relative">
              <Search aria-hidden="true" size={17} className="pointer-events-none absolute top-3.5 left-3 text-muted" />
              <input className={`${control} w-full pl-9 pr-3 font-normal placeholder:text-muted`} type="search" name="q" maxLength={userSearchLimit}
                defaultValue={query.q} placeholder="Search by name or email" />
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
            {fields.map(({ name, label, options }) => (
              <label key={name} className="grid min-w-0 gap-1.5 text-xs font-semibold">
                {label}
                <select className={`${control} w-full px-2 font-medium sm:w-auto sm:px-3`} name={name} defaultValue={query[name]}>
                  {options.map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                </select>
              </label>
            ))}
            <div className="flex flex-wrap items-end gap-1.5 self-end">
              <button className={`${control} border-[#F1CBD8] bg-pink-soft px-3.5 font-semibold text-[#91314E] hover:bg-pink-card`} disabled={pending}>Apply</button>
              <button type="reset" onClick={() => navigate(usersPath)} className={`${control} border-transparent px-2 text-muted hover:bg-pink-soft`}>Reset<span className="sr-only"> filters</span></button>
            </div>
          </div>
        </form>
        <div aria-busy={pending}>
          {pending && <p role="status" className="border-b border-border bg-pink-soft px-4 py-2 text-xs text-[#91314E] sm:px-5">Updating directory…</p>}
          {error ? <div role="alert" className="px-4 py-8 sm:px-5">
            <p className="text-sm font-semibold">{error}</p>
            {!page && <button type="button" className={`${control} mt-3 px-3`} onClick={refresh}>Try again</button>}
          </div> : page?.rows.length === 0 ? <div className="px-4 py-10 sm:px-5">
            <p className="font-semibold">{filtered ? "No matching users" : "No users yet"}</p>
            <p className="mt-1 text-sm text-muted">{filtered ? "Search from the start of a name or email, or reset the filters." : "Learner accounts will appear here after registration."}</p>
            {filtered && <Link href={usersPath} prefetch={false} className={`${control} mt-3 px-3`}>Reset filters</Link>}
          </div> : page && <>
            <table className="hidden w-full table-fixed text-left text-sm md:table">
              <caption className="sr-only">Learner accounts</caption>
              <thead className="border-b border-border bg-[#FFFAFC] text-xs text-[#665C65]">
                <tr>
                  <th scope="col" className="w-[34%] px-5 py-3 font-semibold">User</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Verification</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Joined <span className="font-normal">(UTC)</span></th>
                  <th scope="col" className="w-28 px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {page.rows.map(user => <tr className="hover:bg-[#FFFAFC]" key={user.id}>
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
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
              <p className="text-sm text-muted tabular-nums" aria-live="polite">
                {page.start !== null && page.total !== null && page.start + page.rows.length - 1 <= page.total
                  ? `Showing ${number.format(page.start)}–${number.format(page.start + page.rows.length - 1)} of ${number.format(page.total)}`
                  : `Showing ${page.rows.length} users on this page`}
              </p>
              <nav aria-label="Directory pagination" className="flex flex-wrap gap-2">
                {([["Previous", page.previous, ChevronLeft], ["Next", page.next, ChevronRight]] as const).map(([label, token, Icon]) => {
                  const content = <>{label === "Previous" && <Icon size={15} aria-hidden="true" />}{label}{label === "Next" && <Icon size={15} aria-hidden="true" />}</>;
                  const href = usersHref(query, token);
                  return token && !pending
                    ? <Link key={label} href={href} prefetch={false} scroll={false} className={`${control} px-2.5 hover:bg-pink-soft`}
                      onNavigate={event => { event.preventDefault(); navigate(href); }}>{content}</Link>
                    : <button key={label} type="button" disabled className={`${control} px-2.5 opacity-45`}>{content}</button>;
                })}
              </nav>
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
