import "server-only";
import { Types } from "mongoose";
import type { Document, Filter } from "mongodb";
import { openUsersToken, sealUsersToken } from "@/lib/admin/users-tokens";
import { securityDatabase } from "@/lib/auth/security-evidence";
import { ADMIN_SUBJECT } from "@/models/Admin";
import {
  auditLabels, eventLabels, dayMs, auditRetentionDays, eventRetentionDays, isAccountId, isCorrelationId, isScope,
  securityTimelineIndex, securityCorrelationIndex, securityPeriods, type Actor, type Outcome, type Period, type SecurityRow, type Source,
} from "./security-contract";

const minute = 60_000;
const pageSize = 20;
const candidates = 600;
const summaryLimit = 12_000;
const keyPattern = /^(?:[a-f\d]{24}|[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}|(?:v2\/)?[a-z][a-z-]{1,28}\/(?:[a-z][a-z-]{1,30}\/)?\d{1,10})$/i;
const outcomes = ["success", "failure", "denied", "rate-limited", "committed"] as const;
const actors = ["admin", "learner", "unknown"] as const;
const categories = ["all", "authentication", "rate", "audit"] as const;

export class SecurityQueryError extends Error {}

function calendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value ? +parsed : NaN;
}

export function parseSecurityQuery(params: Record<string, string | string[] | undefined>, now = new Date()) {
  for (const [key, value] of Object.entries(params)) {
    if (!["period", "category", "kind", "outcome", "actor", "from", "to", "q", "cursor"].includes(key) ||
      Array.isArray(value) || (value && value.length > (key === "cursor" ? 1024 : 110))) {
      throw new SecurityQueryError("One or more filters are invalid.");
    }
  }
  const one = (key: string) => typeof params[key] === "string" ? params[key] : "";
  const period = one("period") || "24h";
  const category = one("category") || "all";
  const kind = one("kind");
  const outcome = one("outcome");
  const actor = one("actor");
  const from = one("from");
  const to = one("to");
  const q = one("q").trim();
  if (!Object.hasOwn(securityPeriods, period) || !(categories as readonly string[]).includes(category) ||
      (kind && !Object.hasOwn(auditLabels, kind) && !Object.hasOwn(eventLabels, kind)) ||
      (outcome && !(outcomes as readonly string[]).includes(outcome)) || (actor && !(actors as readonly string[]).includes(actor)) ||
      (q && !keyPattern.test(q))) throw new SecurityQueryError("Choose a listed filter or enter an exact event or correlation ID.");

  // Count buckets are whole UTC minutes. The open minute remains outside the read snapshot.
  const snapshot = Math.floor(+now / minute) * minute;
  const start = from ? calendarDay(from) : snapshot - securityPeriods[period as Period] * dayMs;
  const end = to ? Math.min(snapshot, calendarDay(to) + dayMs) : snapshot;
  if (Boolean(from) !== Boolean(to) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
      end - start > 30 * dayMs || start < snapshot - (auditRetentionDays + 1) * dayMs) {
    throw new SecurityQueryError("Choose both UTC dates and a range of at most 30 days within retained history.");
  }
  return { period: period as Period, category, kind, outcome, actor, from, to, q: q.toLowerCase(), start, end, snapshot, retentionAt: snapshot, token: one("cursor") };
}

export type SecurityQuery = ReturnType<typeof parseSecurityQuery>;

export function projectSecurity(raw: Document, source: Source): SecurityRow | null {
  const id = raw._id instanceof Types.ObjectId ? raw._id.toHexString() : raw._id;
  if (typeof id !== "string" || !keyPattern.test(id) || !(raw.occurredAt instanceof Date) || !Number.isFinite(+raw.occurredAt)) return null;
  const at = +raw.occurredAt;
  if (source === "audit") {
    if (!isAccountId(id)) return null;
    if (typeof raw.action !== "string" || !Object.hasOwn(auditLabels, raw.action) || raw.outcome !== "committed" || raw.actorId !== ADMIN_SUBJECT) return null;
    const kind = raw.action as keyof typeof auditLabels;
    const target = raw.targetId === ADMIN_SUBJECT ? { kind: "Administrator" as const, id: ADMIN_SUBJECT }
      : isAccountId(raw.targetId) ? { kind: kind.startsWith("announcement.") ? "Announcement" as const : "Learner" as const, id: raw.targetId } : null;
    return { id, source, kind, label: auditLabels[kind], at, lastAt: at, actor: "admin", actorId: ADMIN_SUBJECT, target,
      outcome: kind === "login" ? "success" : "committed", correlation: isCorrelationId(raw.correlationId) ? raw.correlationId : null,
      count: 1, scope: null, coverage: "committed" };
  }

  // The transactional collection is the sole source of committed actions.
  if (typeof raw.kind !== "string" || !Object.hasOwn(eventLabels, raw.kind)) return null;
  const kind = raw.kind as keyof typeof eventLabels;
  const modern = raw.format === 2;
  if (!modern && (!["login-denied", "mfa-denied", "access-denied", "recovery-denied"].includes(kind) ||
    id.split("/")[0] !== kind || !/^\d{1,10}$/.test(id.split("/")[1] ?? ""))) return null;
  const attributed = modern && ["learner-login", "email-login", "password-reset", "password-change"].includes(kind) && isAccountId(raw.actorId);
  const actorId: string | null = attributed ? raw.actorId : null;
  const count = !modern ? null : attributed ? 1
    : typeof raw.count === "number" && Number.isSafeInteger(raw.count) && raw.count > 0 ? raw.count : null;
  if (modern && count === null) return null;
  const scope = modern && kind === "rate-limited" && isScope(raw.scope) ? raw.scope : null;
  if (kind === "rate-limited" && !scope) return null;
  if (modern) {
    const segment = scope ?? (kind === "access-denied" && raw.verifiedAccess === true ? "verified" : "all");
    if (attributed ? !/^[0-9a-f]{32}$/.test(id) : id !== `v2/${kind}/${segment}/${Math.floor(at / minute)}`) return null;
  }
  const lastAt = modern && raw.lastAt instanceof Date && Number.isFinite(+raw.lastAt) && +raw.lastAt >= at ? +raw.lastAt : at;
  const actor: Actor = attributed ? "learner" : modern && kind === "access-denied" && raw.verifiedAccess === true ? "admin" : "unknown";
  const outcome: Outcome = attributed ? "success" : kind === "rate-limited" ? "rate-limited" :
    kind === "learner-login-denied" || kind === "login-denied" ? "failure" : "denied";
  return { id, source, kind, label: eventLabels[kind], at, lastAt, actor, actorId: actorId ?? (actor === "admin" ? ADMIN_SUBJECT : null),
    target: actorId ? { kind: "Learner", id: actorId } : null, outcome, correlation: null, count, scope,
    coverage: modern ? "observed" : "representative" };
}

const isAction = (row: SecurityRow) => row.source === "audit" && row.kind !== "login" && row.kind !== "logout";
const isLoginFailure = (row: SecurityRow) => row.kind === "learner-login-denied" || row.kind === "login-denied";
const isLoginSuccess = (row: SecurityRow) => row.kind === "login" || row.kind === "learner-login" || row.kind === "email-login";

type Alert = { kind: SecurityRow["kind"]; title: string; severity: "Warning"; count: number; first: number; last: number; end: number; rule: string };
export function summarizeSecurity(query: SecurityQuery, audits: SecurityRow[], events: SecurityRow[], limited: boolean) {
  const all = [...audits, ...events];
  const observed = events.filter(event => event.coverage === "observed");
  const legacy = events.length - observed.length;
  const first = observed.reduce((value, row) => Math.min(value, row.at), Infinity);
  const last = all.reduce((value, row) => Math.max(value, row.lastAt), 0);
  const count = (where: (event: SecurityRow) => boolean) => observed.length ? observed.filter(where).reduce((sum, row) => sum + (row.count ?? 0), 0) : null;
  const resolution = query.end - query.start <= dayMs ? 60 * minute : query.end - query.start <= 7 * dayMs ? 360 * minute : dayMs;
  const base = Math.floor(query.start / resolution) * resolution;
  const chart = Array.from({ length: Math.ceil((query.end - base) / resolution) }, (_, index) => ({
    from: Math.max(query.start, base + index * resolution),
    to: Math.min(query.end, base + (index + 1) * resolution),
    success: 0, failure: 0, rate: 0,
  }));
  const five = 5 * minute;
  const signals = new Map<number, { password: number; mfa: number; rate: number; access: number; last: number; adminPasswords: number }>();
  for (const row of all) {
    if (row.count === null) continue;
    const bin = chart[Math.floor((row.at - base) / resolution)];
    if (bin && (isLoginSuccess(row) || isLoginFailure(row) || row.kind === "mfa-denied" || row.kind === "rate-limited")) {
      if (isLoginSuccess(row)) bin.success += row.count;
      else if (row.kind === "rate-limited") bin.rate += row.count;
      else bin.failure += row.count;
    }
    const slot = Math.floor(row.at / five) * five;
    if (slot < query.start || slot + five > query.end) continue;
    const signal = signals.get(slot) ?? { password: 0, mfa: 0, rate: 0, access: 0, last: 0, adminPasswords: 0 };
    if (isLoginFailure(row)) {
      signal.password += row.count;
      if (row.kind === "login-denied") signal.adminPasswords += row.count;
    } else if (row.kind === "mfa-denied") signal.mfa += row.count;
    else if (row.kind === "rate-limited") signal.rate += row.count;
    else if (row.kind === "access-denied" && row.actor === "admin") signal.access += row.count;
    else continue;
    signal.last = Math.max(signal.last, row.lastAt);
    signals.set(slot, signal);
  }

  const alerts: Alert[] = [];
  const entries = [...signals].sort(([a], [b]) => a - b);
  for (const [title, kind, key, threshold, span] of [
    ["Sustained password failures", "learner-login-denied", "password", 10, 2],
    ["Repeated MFA rejections", "mfa-denied", "mfa", 5, 1],
    ["Elevated rate limiting", "rate-limited", "rate", 25, 1],
    ["Repeated administrator access denials", "access-denied", "access", 3, 1],
  ] as const) {
    let group: typeof entries = [];
    const add = () => {
      if (group.length < span) return;
      const value = group.reduce((total, [, signal]) => total + signal[key], 0);
      const actualKind = key === "password" && group.some(([, signal]) => signal.adminPasswords > 0) ? "login-denied" : kind;
      alerts.push({ title, kind: actualKind, severity: "Warning", count: value, first: group[0][0],
        last: Math.max(...group.map(([, signal]) => signal.last)), end: group.at(-1)![0] + five, rule: `${threshold} or more per complete 5-minute interval${span > 1 ? " for at least two consecutive intervals" : ""}` });
    };
    for (const entry of entries) {
      if (entry[1][key] < threshold || (group.length && entry[0] - group.at(-1)![0] !== five)) {
        add();
        group = [];
      }
      if (entry[1][key] >= threshold) group.push(entry);
    }
    add();
  }
  return { failedLogins: count(isLoginFailure), rateLimited: count(row => row.kind === "rate-limited"),
    actions: audits.filter(isAction).length, recentActions: audits.filter(isAction).slice(0, 5),
    legacy, first: Number.isFinite(first) ? first : null, last: last || null, chart, limited,
    alertCount: alerts.length, alerts: alerts.sort((a, b) => b.last - a.last).slice(0, 5) };
}

type Anchor = { at: number; source: Source; id: string };
const priority = { audit: 1, event: 0 };
const sortRows = (a: Anchor, b: Anchor) => b.at - a.at || priority[b.source] - priority[a.source] || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
type SecurityDocument = Document & { _id: string | Types.ObjectId };
const collections = { audit: "adminauditlogs", event: "adminsecurityevents" };
const projections = {
  audit: { occurredAt: 1, actorId: 1, action: 1, targetId: 1, correlationId: 1, outcome: 1 },
  event: { occurredAt: 1, kind: 1, actorId: 1, lastAt: 1, count: 1, scope: 1, format: 1, verifiedAccess: 1 },
} as const;

function cursorContext(q: SecurityQuery) {
  return JSON.stringify(["abii-security-v1", q.period, q.from, q.to, q.category, q.kind, q.outcome, q.actor, q.q]);
}

function readCursor(query: SecurityQuery) {
  if (!query.token) return null;
  const value = openUsersToken(query.token, cursorContext(query)) as Partial<Anchor & { snapshot: number; issued: number }> | null;
  if (!value || (value.source !== "audit" && value.source !== "event") || typeof value.id !== "string" || !keyPattern.test(value.id) ||
      (value.source === "audit" && !isAccountId(value.id)) || typeof value.at !== "number" || !Number.isSafeInteger(value.at) ||
      typeof value.snapshot !== "number" || !Number.isSafeInteger(value.snapshot) || value.snapshot > query.snapshot ||
      typeof value.issued !== "number" || query.snapshot - value.issued > 30 * minute || value.issued > query.snapshot) {
    throw new SecurityQueryError("This page link has expired or belongs to a different filter. Open the first page.");
  }
  return { at: value.at, source: value.source, id: value.id, snapshot: value.snapshot, issued: value.issued };
}

async function scan(source: Source, query: SecurityQuery, limit: number, anchor?: Anchor, exact?: string) {
  const { start, end, retentionAt } = query;
  const filter: Filter<SecurityDocument> = { occurredAt: { $gte: new Date(Math.max(start, retentionAt -
    (source === "audit" ? auditRetentionDays : eventRetentionDays) * dayMs)), $lt: new Date(end) } };
  let hint: string = securityTimelineIndex;
  if (anchor) {
    const time = new Date(anchor.at);
    if (anchor.source === source) {
      filter.$or = [{ occurredAt: { $lt: time } }, { occurredAt: time, _id: { $lt: source === "audit" ? new Types.ObjectId(anchor.id) : anchor.id } }];
    } else {
      filter.occurredAt = { ...filter.occurredAt, ...(priority[source] < priority[anchor.source] ? { $lte: time } : { $lt: new Date(Math.min(end, anchor.at)) }) };
    }
  }
  if (exact) {
    if (source === "audit" && isCorrelationId(exact)) {
      hint = securityCorrelationIndex;
      filter.correlationId = exact;
    } else if (source === "audit" && !isAccountId(exact)) return [];
    else {
      hint = "_id_";
      filter._id = source === "audit" ? new Types.ObjectId(exact) : exact;
    }
  }
  const docs = await securityDatabase().collection<SecurityDocument>(collections[source])
    .find(filter, { hint, projection: projections[source], collation: { locale: "simple" }, timeoutMS: 1700 })
    .sort({ occurredAt: -1, _id: -1 }).limit(limit).toArray();
  return docs.flatMap(doc => {
    const row = projectSecurity(doc, source);
    // Preserve scan progress without returning invalid or unrecognized data to clients.
    const at = +doc.occurredAt;
    const id = doc._id instanceof Types.ObjectId ? doc._id.toHexString() : doc._id;
    return typeof id === "string" && keyPattern.test(id) && Number.isFinite(at) ? [{ at, id, source, row }] : [];
  });
}

function matches(row: SecurityRow, query: SecurityQuery) {
  const category = row.source === "audit" ? "audit" : row.kind === "rate-limited" ? "rate" : "authentication";
  return (query.category === "all" || query.category === category) && (!query.kind || query.kind === row.kind) &&
    (!query.actor || query.actor === row.actor) && (!query.outcome || query.outcome === row.outcome);
}

async function readPair(query: SecurityQuery, limit: number, anchor?: Anchor, exact?: string) {
  const result = await Promise.allSettled([scan("audit", query, limit, anchor, exact), scan("event", query, limit, anchor, exact)]);
  return result.map(item => item.status === "fulfilled" ? item.value : null);
}

export async function readSecurity(query: SecurityQuery) {
  const cursor = readCursor(query);
  const snapshot = cursor?.snapshot ?? query.snapshot;
  const view = cursor ? { ...parseSecurityQuery({ period: query.period, from: query.from, to: query.to,
    category: query.category, kind: query.kind, outcome: query.outcome, actor: query.actor, q: query.q }, new Date(snapshot)),
    retentionAt: query.retentionAt, token: query.token } : query;
  if (cursor && (cursor.at < view.start || cursor.at >= view.end)) throw new SecurityQueryError("This page link is outside the current date range.");
  const [audit, events] = await readPair(view, summaryLimit + 1);
  const takeRows = (items: typeof audit) => (items ?? []).slice(0, summaryLimit).flatMap(item => item.row ? [item.row] : []);
  const summary = summarizeSecurity(view, takeRows(audit), takeRows(events), [audit, events].some(items => (items?.length ?? 0) > summaryLimit));
  const [auditPage, eventPage] = await readPair(view, candidates + 1, cursor ?? undefined, view.q || undefined);
  const records = [...(auditPage ?? []), ...(eventPage ?? [])].sort(sortRows);
  const rows: SecurityRow[] = [];
  let examined = 0;
  while (examined < Math.min(records.length, candidates) && rows.length < pageSize) {
    const row = records[examined++].row;
    if (row && matches(row, view)) rows.push(row);
  }
  const last = records[examined - 1];
  const next = last && auditPage && eventPage && examined < records.length
    ? sealUsersToken({ at: last.at, id: last.id, source: last.source, snapshot, issued: cursor?.issued ?? snapshot }, cursorContext(query)) : null;
  return { query: view, summary, auditAvailable: audit !== null, eventsAvailable: events !== null,
    explorerAvailable: auditPage !== null || eventPage !== null, explorerPartial: auditPage === null || eventPage === null, rows, next };
}
export type SecurityReport = Awaited<ReturnType<typeof readSecurity>>;
