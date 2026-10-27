"use client";

import Link from "next/link";
import { useState } from "react";
import { MasteryProgressBar } from "@/components/progress/mastery-progress-bar";
import { Layers3, Target, CalendarDays, Flame, Leaf, BookOpen, RefreshCw, ArrowRight } from "lucide-react";
import { FeaturedBadges } from "@/components/badges/featured-badges";
import type { FeaturedBadgeShowcase } from "@/components/badges/featured-types";

type ActivityPoint = { date: string; label: string; sessions: number; cards: number };
type SubjectRow = { id: string; name: string; totalCards: number; reviewed: number; accuracy: number | null; progress: number; mastered: number; usable: number; completedRequirements: number; totalRequirements: number };
type TopicRow = { id: string; subjectId: string; subject: string; name: string; totalCards: number; mastered: number; usable: number; progress: number; completedRequirements: number; totalRequirements: number };
type ChallengingCard = { id: string; question: string; subject: string; wrong: number; total: number; wrongRate: number; subjectId: string };
type RecentSession = { id: string; subject: string; type: string; date: string; correct: number; answered: number; accuracy: number | null };
export type ProgressPayload = {
  summary: { totalReviews: number; accuracy: number | null; sessions: number; streak: number; masteredCards: number; totalCards: number; masteryProgress: number; completedRequirements: number; totalRequirements: number };
  activity: ActivityPoint[];
  subjects: SubjectRow[];
  topics: TopicRow[];
  challengingCards: ChallengingCard[];
  lowerAccuracySubjects: SubjectRow[];
  recentSessions: RecentSession[];
};

const pink = "#FF6F96";
const mutedPink = "#FFC9D8";
const ink = "#183653";
const muted = "#58718B";
const border = "#E8E2E5";
const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);
const formatDate = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) { const icons: Record<string, typeof Layers3> = { cards: Layers3, target: Target, calendar: CalendarDays, flame: Flame, leaf: Leaf, book: BookOpen, refresh: RefreshCw, arrow: ArrowRight }; const Component = icons[name] ?? Target; return <Component className={className} aria-hidden="true" />; }

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-2xl border bg-white p-4 sm:p-5 ${className}`} style={{ borderColor: border }}>{children}</section>;
}

function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold sm:text-base" style={{ color: ink }}>{title}</h3>{subtitle && <p className="mt-1 text-xs leading-5" style={{ color: muted }}>{subtitle}</p>}</div>{action}</div>;
}

function StudyChart({ points }: { points: ActivityPoint[] }) {
  const [range, setRange] = useState<7 | 30 | 90>(7);
  const data = points.slice(-range);
  const maxValue = Math.max(4, ...data.map((p) => Math.max(p.sessions, p.cards)));
  const width = 640, height = 205, left = 30, right = 12, top = 12, bottom = 32;
  const chartW = width - left - right, chartH = height - top - bottom;
  const x = (i: number) => left + (data.length <= 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
  const y = (value: number) => top + chartH - (value / maxValue) * chartH;
  const barWidth = Math.max(2, Math.min(12, chartW / data.length * 0.48));
  const line = data.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.sessions)}`).join(" ");
  const labelEvery = range === 7 ? 1 : range === 30 ? 5 : 15;
  return <Panel>
    <SectionHeading title="Study Activity" subtitle="Your study consistency over time." action={<div className="flex shrink-0 gap-1 rounded-full bg-[#FFF7F9] p-1">{([7, 30, 90] as const).map((n) => <button key={n} onClick={() => setRange(n)} className={`rounded-full px-2.5 py-1.5 text-[10px] font-semibold transition sm:px-3 ${range === n ? "text-white shadow-sm" : "text-[#58718B] hover:bg-white"}`} style={range === n ? { background: pink } : undefined}>{n} days</button>)}</div>} />
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-2 text-[10px]" style={{ color: muted }}><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: pink }} />Study sessions</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: mutedPink }} />Flashcards reviewed</span></div>
    <div className="w-full overflow-hidden"><svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`Study activity for the last ${range} days`}>
      {[0, 1, 2, 3].map((tick) => { const val = Math.round((maxValue * tick) / 3); const yy = y(val); return <g key={tick}><line x1={left} y1={yy} x2={width - right} y2={yy} stroke="#F0ECEE" strokeDasharray="3 4"/><text x={left - 8} y={yy + 3} fontSize="9" textAnchor="end" fill="#8A9AAC">{val}</text></g>; })}
      {data.map((p, i) => <rect key={p.date} x={x(i) - barWidth / 2} y={y(p.cards)} width={barWidth} height={Math.max(0, top + chartH - y(p.cards))} rx="3" fill={mutedPink} opacity="0.95" />)}
      <path d={line} fill="none" stroke={pink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.sessions)} r={range === 7 ? 3 : 2} fill="white" stroke={pink} strokeWidth="2" />)}
      {data.map((p, i) => i % labelEvery === 0 || i === data.length - 1 ? <text key={p.date} x={x(i)} y={height - 10} fontSize="9" textAnchor="middle" fill="#7B91A7">{p.label}</text> : null)}
    </svg></div>
    <div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#FFF7F9] p-3"><p className="text-[10px]" style={{ color: muted }}>Study sessions · {range} days</p><p className="mt-1 text-xl font-bold" style={{ color: ink }}>{data.reduce((sum, p) => sum + p.sessions, 0)}</p></div><div className="rounded-xl bg-[#FFF7F9] p-3"><p className="text-[10px]" style={{ color: muted }}>Flashcards reviewed · {range} days</p><p className="mt-1 text-xl font-bold" style={{ color: ink }}>{formatNumber(data.reduce((sum, p) => sum + p.cards, 0))}</p></div></div>
  </Panel>;
}

export function ProgressDashboard({ data, featuredShowcase, featuredShowcaseError = false }: { data: ProgressPayload; featuredShowcase: FeaturedBadgeShowcase | null; featuredShowcaseError?: boolean }) {
  const metrics = [
    { label: "Total Flashcards Reviewed", value: formatNumber(data.summary.totalReviews), icon: "cards", note: "Answer attempts" },
    { label: "Overall Answer Accuracy", value: data.summary.accuracy === null ? "—" : `${data.summary.accuracy}%`, icon: "target", note: data.summary.accuracy === null ? "Complete a review to begin" : "Across answered questions" },
    { label: "Study Sessions Completed", value: formatNumber(data.summary.sessions), icon: "calendar", note: "Completed quizzes" },
    { label: "Current Study Streak", value: `${data.summary.streak} ${data.summary.streak === 1 ? "day" : "days"}`, icon: "flame", note: data.summary.streak ? "Keep it up!" : "Start a streak today" },
  ];
  return <div className="w-full min-w-0">
    <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">{metrics.map((metric) => <div key={metric.label} className="min-w-0 rounded-2xl border bg-white p-3 sm:p-4" style={{ borderColor: border }}><div className="flex items-start gap-2.5 sm:gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFE8EF] text-[#E9577D] sm:h-11 sm:w-11"><Icon name={metric.icon} /></div><div className="min-w-0"><p className="text-[10px] leading-4 sm:text-xs" style={{ color: muted }}>{metric.label}</p><p className="mt-1 break-words text-xl font-bold sm:text-2xl" style={{ color: ink }}>{metric.value}</p><p className="mt-1 text-[9px] leading-4 sm:text-[10px]" style={{ color: muted }}>{metric.note}</p></div></div></div>)}<div className="flex min-w-0 items-center rounded-2xl border bg-white p-3 sm:p-4" style={{ borderColor: border }}><MasteryProgressBar label="Overall Mastery" ariaLabel="Overall mastery progress" progress={data.summary.masteryProgress} size="lg" className="w-full" /></div></div>
    <div className="mb-4"><FeaturedBadges surface="progress" initialShowcase={featuredShowcase} initialError={featuredShowcaseError} /></div>
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,0.95fr)]">
      <div className="flex min-w-0 flex-col gap-4"><StudyChart points={data.activity} />
        <Panel><div id="subject-performance"><SectionHeading title="Subject Performance" subtitle="Incremental mastery requirements and fully mastered flashcards." />
          {data.subjects.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[560px] text-left text-xs"><thead><tr className="border-b text-[10px]" style={{ color: muted, borderColor: "#F0ECEE" }}>{["Subject", "Total Cards", "Reviewed", "Accuracy", "Mastery", "Action"].map((x) => <th key={x} className="px-2 py-3 font-medium">{x}</th>)}</tr></thead><tbody>{data.subjects.map((s) => <tr key={s.id} className="border-b last:border-0" style={{ borderColor: "#F4F0F2" }}><td className="px-2 py-3 font-semibold" style={{ color: ink }}><span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF0F4] text-[#E9577D]"><Icon name="book" className="h-4 w-4" /></span>{s.name}</td><td className="px-2 py-3" style={{ color: muted }}>{s.totalCards}</td><td className="px-2 py-3" style={{ color: muted }}>{s.reviewed}</td><td className="px-2 py-3 font-semibold" style={{ color: ink }}>{s.accuracy === null ? "—" : `${s.accuracy}%`}</td><td className="px-2 py-3"><div className="flex items-center gap-2"><MasteryProgressBar label="Mastery" ariaLabel={`${s.name} mastery progress`} progress={s.progress} className="w-44" /><span className="text-[10px]" style={{ color: muted }}>{s.completedRequirements}/{s.totalRequirements} requirements · {s.mastered}/{s.totalCards} fully mastered</span></div></td><td className="px-2 py-3"><Link href={`/subjects/${s.id}`} className="inline-flex rounded-full border px-3 py-1.5 text-[10px] font-semibold text-[#E9577D] hover:bg-[#FFF7F9]" style={{ borderColor: "#F5C8D6" }}>Review</Link></td></tr>)}</tbody></table></div><div className="space-y-3 md:hidden">{data.subjects.map((s) => <div key={s.id} className="rounded-xl border p-3" style={{ borderColor: "#F0ECEE" }}><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold" style={{ color: ink }}>{s.name}</p><p className="mt-1 text-[10px]" style={{ color: muted }}>{s.completedRequirements}/{s.totalRequirements} requirements · {s.mastered}/{s.totalCards} fully mastered · {s.reviewed} reviewed</p></div><span className="text-xs font-semibold" style={{ color: ink }}>{s.accuracy === null ? "—" : `${s.accuracy}%`}</span></div><div className="mt-3 flex items-center gap-3"><MasteryProgressBar label="Mastery" ariaLabel={`${s.name} mastery progress`} progress={s.progress} className="min-w-0 flex-1" /><Link href={`/subjects/${s.id}`} className="text-xs font-semibold text-[#E9577D]">Review</Link></div></div>)}</div></> : <EmptyState title="No subjects yet" text="Create a subject and add flashcards to start tracking your learning." href="/subjects" action="Go to My Subjects" />}
        </div></Panel>
        <Panel><SectionHeading title="Topic Mastery" subtitle="See progress within each subject topic." />
          {data.topics.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{data.topics.map((topic) => <Link key={topic.id} href={`/subjects/${topic.subjectId}/topics/${topic.id}`} className="min-w-0 rounded-xl border p-3 transition hover:bg-[#FFF9FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]" style={{ borderColor: "#F0ECEE" }}><div className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block truncate text-xs font-semibold" style={{ color: ink }}>{topic.name}</span><span className="mt-0.5 block truncate text-[10px]" style={{ color: muted }}>{topic.subject} · {topic.completedRequirements}/{topic.totalRequirements} requirements · {topic.mastered}/{topic.totalCards} fully mastered</span></span></div><MasteryProgressBar label="Mastery" ariaLabel={`${topic.subject}, ${topic.name} mastery progress`} progress={topic.progress} className="mt-2" /></Link>)}</div> : <p className="rounded-xl bg-[#FFF7F9] p-3 text-xs leading-5" style={{ color: muted }}>Create topics in a subject to see topic progress here.</p>}
        </Panel>
      </div>
      <div className="flex min-w-0 flex-col gap-4"><Panel><SectionHeading title="Needs More Practice" subtitle="Let's focus on these areas to improve even more!" />
        <div className="mb-4"><div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-bold" style={{ color: ink }}>Challenging Flashcards</h4><Link href="/subjects" className="text-[10px] font-semibold text-[#E9577D]">View subjects <Icon name="arrow" className="ml-1 inline h-3 w-3" /></Link></div>
          {data.challengingCards.length ? <div className="space-y-2">{data.challengingCards.map((card, index) => <Link href={`/subjects/${card.subjectId}`} key={card.id} className="flex items-center gap-3 rounded-xl border p-3 transition hover:bg-[#FFF9FB]" style={{ borderColor: "#F0ECEE" }}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${index ? "bg-[#FFF0F4] text-[#E9577D]" : "bg-[#EAF8F0] text-[#4E9B7C]"}`}><Icon name={index ? "book" : "leaf"} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold" style={{ color: ink }}>{card.question}</span><span className="mt-1 block text-[10px]" style={{ color: muted }}>{card.subject}</span></span><span className="shrink-0 text-[10px] font-medium" style={{ color: muted }}>{card.wrong}/{card.total} wrong</span></Link>)}</div> : <p className="rounded-xl bg-[#FFF7F9] p-3 text-xs leading-5" style={{ color: muted }}>Keep reviewing your flashcards. Challenging cards will appear here after repeated attempts.</p>}
        </div>
        <div className="border-t pt-4" style={{ borderColor: "#F0ECEE" }}><div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-bold" style={{ color: ink }}>Lower Accuracy Subjects</h4><Link href="#subject-performance" onClick={(e) => { e.preventDefault(); document.getElementById("subject-performance")?.scrollIntoView({ behavior: "smooth" }); }} className="text-[10px] font-semibold text-[#E9577D]">View all</Link></div>
          {data.lowerAccuracySubjects.length ? <div className="space-y-3">{data.lowerAccuracySubjects.map((s) => <div key={s.id}><div className="mb-1.5 flex justify-between gap-2 text-xs"><span className="truncate font-medium" style={{ color: ink }}>{s.name}</span><span style={{ color: muted }}>{s.accuracy}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#F0ECEE]"><div className="h-full rounded-full" style={{ width: `${s.accuracy}%`, background: pink }} /></div></div>)}</div> : <p className="text-xs leading-5" style={{ color: muted }}>More answer history is needed before comparing subject accuracy.</p>}
        </div>
        <Link href="/subjects" className="mt-5 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-xs font-bold text-white transition hover:brightness-95" style={{ background: pink }}><Icon name="refresh" className="h-4 w-4" /> Review My Subjects</Link>
      </Panel>
      <Panel><SectionHeading title="Recent Study Sessions" subtitle="Your latest completed quizzes." action={<Link href="/review" className="whitespace-nowrap text-[10px] font-semibold text-[#E9577D]">Review <Icon name="arrow" className="ml-1 inline h-3 w-3" /></Link>} />
        {data.recentSessions.length ? <div className="space-y-0">{data.recentSessions.map((session) => <div key={session.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b py-3 last:border-0" style={{ borderColor: "#F0ECEE" }}><div className="min-w-0"><p className="truncate text-xs font-semibold" style={{ color: ink }}>{session.subject}</p><p className="mt-1 text-[10px]" style={{ color: muted }}>{session.type} · {formatDate(session.date)}</p></div><div className="text-right"><p className="text-xs font-semibold" style={{ color: ink }}>{session.correct}/{session.answered}</p><p className="mt-1 text-[10px]" style={{ color: muted }}>{session.accuracy === null ? "—" : `${session.accuracy}%`}</p></div></div>)}</div> : <EmptyState title="No completed sessions yet" text="Finish your first quiz and your study history will show up here." href="/review" action="Start a review" />}
      </Panel></div>
    </div>
  </div>;
}

function EmptyState({ title, text, href, action }: { title: string; text: string; href: string; action: string }) {
  return <div className="rounded-xl bg-[#FFF7F9] px-4 py-6 text-center"><p className="text-sm font-semibold" style={{ color: ink }}>{title}</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5" style={{ color: muted }}>{text}</p><Link href={href} className="mt-3 inline-flex rounded-full bg-[#FF6F96] px-4 py-2 text-xs font-semibold text-white">{action}</Link></div>;
}
