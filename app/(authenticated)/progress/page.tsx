import { redirect } from "next/navigation";
import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import { ProgressDashboard, type ProgressPayload } from "@/components/progress/progress-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Subject } from "@/models/Subject";
import { QuizSession } from "@/models/QuizSession";
import { Topic } from "@/models/Topic";
import { getSubjectMastery } from "@/lib/quiz/service";
import { FeaturedBadgesStream } from "@/components/badges/featured-badges-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const percent = (numerator: number, denominator: number) => denominator ? Math.round((numerator / denominator) * 100) : null;

export default async function ProgressPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await connectToDatabase();

  const userId = user._id;
  const now = new Date();
  const today = startOfDay(now);
  const chartStart = new Date(today.getTime() - 89 * DAY);

  const [subjects, topics, sessions, mastery] = await Promise.all([
    Subject.find({ userId }).select("_id name").lean(),
    Topic.find({ userId }).select("_id subjectId name").sort({ subjectId: 1, name: 1 }).lean(),
    QuizSession.find({ userId, status: "completed" }).select("_id subjectId subjectName type questions completedAt createdAt").lean(),
    getSubjectMastery(userId),
  ]);

  const flashcards = mastery.cardSummaries;
  const reviews = mastery.reviewHistory;
  const recentSessions = [...sessions].sort((a, b) => (new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime())).slice(0, 5);

  const subjectNameById = new Map(subjects.map((s) => [String(s._id), s.name]));
  const topicCardCounts = new Map<string, number>();
  const topicSubjectById = new Map(topics.map((topic) => [String(topic._id), String(topic.subjectId)]));
  const subjectStats = new Map<string, { total: number; reviewed: Set<string>; correct: number; answered: number }>();
  for (const subject of subjects) subjectStats.set(String(subject._id), { total: 0, reviewed: new Set(), correct: 0, answered: 0 });
  const cardSubject = new Map<string, string>();
  const cardById = new Map<string, (typeof flashcards)[number]>();
  for (const card of flashcards) {
    const subjectId = card.subjectId;
    const stats = subjectStats.get(subjectId);
    if (stats) stats.total += 1;
    cardSubject.set(card.id, subjectId);
    cardById.set(card.id, card);
    if (card.topicId && topicSubjectById.get(card.topicId) === subjectId) {
      const topicId = card.topicId;
      topicCardCounts.set(topicId, (topicCardCounts.get(topicId) ?? 0) + 1);
    }
  }

  let correctAll = 0;
  let answeredAll = 0;
  const allReviewDays = new Set<string>();
  const activity = Array.from({ length: 90 }, (_, index) => {
    const date = new Date(chartStart.getTime() + index * DAY);
    return { date: dateKey(date), label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), sessions: 0, cards: 0 };
  });
  const activityIndex = new Map(activity.map((item, index) => [item.date, index]));
  const cardAttemptTotals = new Map<string, { wrong: number; total: number }>();

  // Full-history summary is based on actual saved answer records.
  const allReviews = reviews;
  for (const record of allReviews) {
    const key = String(record.flashcardId);
    const subjectId = cardSubject.get(key);
    const stats = subjectId ? subjectStats.get(subjectId) : undefined;
    if (record.result === "correct") { correctAll += 1; if (stats) stats.correct += 1; }
    answeredAll += 1;
    if (stats) { stats.answered += 1; stats.reviewed.add(key); }
    const day = dateKey(new Date(record.reviewedAt));
    allReviewDays.add(day);
    const cardTotal = cardAttemptTotals.get(key) ?? { wrong: 0, total: 0 };
    cardTotal.total += 1;
    if (record.result === "wrong") cardTotal.wrong += 1;
    cardAttemptTotals.set(key, cardTotal);
  }
  for (const record of reviews) {
    const idx = activityIndex.get(dateKey(new Date(record.reviewedAt)));
    if (idx !== undefined) activity[idx].cards += 1;
  }
  for (const session of sessions) {
    const completedAt = session.completedAt ? new Date(session.completedAt) : null;
    if (!completedAt) continue;
    const idx = activityIndex.get(dateKey(completedAt));
    if (idx !== undefined) activity[idx].sessions += 1;
  }

  let streak = 0;
  let cursor = allReviewDays.has(dateKey(today)) ? today : new Date(today.getTime() - DAY);
  while (allReviewDays.has(dateKey(cursor))) { streak += 1; cursor = new Date(cursor.getTime() - DAY); }

  const subjectPerformance = subjects.map((subject) => {
    const id = String(subject._id);
    const stats = subjectStats.get(id)!;
    return {
      id,
      name: subject.name,
      totalCards: stats.total,
      reviewed: stats.reviewed.size,
      accuracy: stats.answered ? percent(stats.correct, stats.answered) : null,
      progress: mastery.bySubject.get(id)?.progress ?? 0,
      mastered: mastery.bySubject.get(id)?.mastered ?? 0,
      usable: mastery.bySubject.get(id)?.usable ?? 0,
      completedRequirements: mastery.bySubject.get(id)?.completedRequirements ?? 0,
      totalRequirements: mastery.bySubject.get(id)?.totalRequirements ?? 0,
    };
  }).sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101));

  const topicPerformance = topics.map((topic) => {
    const id = String(topic._id);
    const subjectId = String(topic.subjectId);
    const stats = mastery.byTopic.get(id);
    return { id, subjectId, subject: subjectNameById.get(subjectId) ?? "Subject", name: topic.name, totalCards: topicCardCounts.get(id) ?? 0, mastered: stats?.mastered ?? 0, usable: stats?.usable ?? 0, progress: stats?.progress ?? 0, completedRequirements: stats?.completedRequirements ?? 0, totalRequirements: stats?.totalRequirements ?? 0 };
  });

  const groupedCardReviews = [...cardAttemptTotals].map(([id, value]) => ({ _id: id, total: value.total, wrong: value.wrong })).filter((item) => item.total >= 2).sort((a, b) => b.wrong - a.wrong || b.total - a.total).slice(0, 20);
  const challengingCards = groupedCardReviews.map((item) => {
    const card = cardById.get(String(item._id));
    if (!card) return null;
    return {
    id: card.id,
      question: card.question,
      subject: subjectNameById.get(card.subjectId) ?? "Subject",
      wrong: item.wrong,
      total: item.total,
      wrongRate: percent(item.wrong, item.total) ?? 0,
      subjectId: card.subjectId,
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item)).slice(0, 2);

  const lowerAccuracySubjects = subjectPerformance.filter((s) => s.accuracy !== null && (subjectStats.get(s.id)?.answered ?? 0) >= 3).slice(0, 3);
  const serializedSessions = recentSessions.map((session) => {
    const questions = session.questions ?? [];
    const answered = questions.filter((q) => q.answered);
    const correct = answered.filter((q) => q.correct).length;
    const date = session.completedAt ? new Date(session.completedAt) : new Date(session.createdAt);
    const type = session.type === "multiple-choice" ? "Multiple Choice" : session.type === "true-false" ? "True or False" : session.type === "identification" ? "Identification" : "Random";
    return { id: String(session._id), subject: session.subjectName, type, date: date.toISOString(), correct, answered: answered.length, accuracy: percent(correct, answered.length) };
  });

  const payload: ProgressPayload = {
    summary: { totalReviews: answeredAll, accuracy: percent(correctAll, answeredAll), sessions: sessions.length, streak, masteredCards: mastery.overall.mastered, totalCards: mastery.overall.total, masteryProgress: mastery.overall.progress, completedRequirements: mastery.overall.completedRequirements, totalRequirements: mastery.overall.totalRequirements },
    activity,
    subjects: subjectPerformance,
    topics: topicPerformance,
    challengingCards,
    lowerAccuracySubjects,
    recentSessions: serializedSessions,
  };

  return (
      <div className="w-full min-w-0 p-4 sm:p-6 xl:p-7">
        <AbiiPageHero
          variant="progress"
          headingId="progress-hero-title"
          title={<><h2 className="text-2xl font-bold leading-tight text-[#183653] sm:text-3xl xl:text-4xl">Your Learning Journey</h2><p className="abii-page-hero__title-emphasis mt-1 text-3xl font-extrabold leading-tight text-[#F15D8A] sm:text-4xl xl:text-[42px]">Looks Great!</p></>}
          description={<p className="mt-3 max-w-md text-sm leading-6 text-[#58718B] sm:text-base sm:leading-7">You&apos;re making steady progress! Keep going and let&apos;s reach your next goal!</p>}
          mascotSrc="/dashboard-hero/progress.png"
          mascotAlt="Abii cheering you on"
          priority
          className="mb-5"
        />
      <ProgressDashboard data={payload} featuredBadges={<FeaturedBadgesStream surface="progress" userId={String(user._id)} />} />
      </div>
    
  );
}
