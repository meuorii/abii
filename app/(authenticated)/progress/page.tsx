import { redirect } from "next/navigation";
import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import { ProgressDashboard, type ProgressPayload } from "@/components/progress/progress-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { getSubjectMastery } from "@/lib/quiz/service";
import { FeaturedBadgesStream } from "@/components/badges/featured-badges-stream";
import { currentConsecutiveDayStreak, normalizeStudyTimezone, recentStudyDayKeys, studyDayKey } from "@/lib/badges/study-day";
import { loadProgressReviewActivity, loadProgressSessionAnalytics } from "@/lib/progress/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const percent = (numerator: number, denominator: number) => denominator ? Math.round((numerator / denominator) * 100) : null;

export default async function ProgressPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await connectToDatabase();

  const userId = user._id;
  const now = new Date();
  const timezone = normalizeStudyTimezone(user.settings?.studyTimezone);
  const todayKey = studyDayKey(now, timezone);

  const [mastery, sessionAnalytics] = await Promise.all([
    getSubjectMastery(userId, undefined, { includeHistory: false, studyTimezone: timezone, includeCatalog: true }),
    loadProgressSessionAnalytics(userId, timezone, todayKey),
  ]);

  const subjects = mastery.subjectCatalog ?? [];
  const topics = mastery.topicCatalog ?? [];

  const flashcards = mastery.cardSummaries;
  const reviewActivity = await loadProgressReviewActivity(userId, flashcards.map((card) => card.id), timezone, todayKey);

  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
  const topicCardCounts = new Map<string, number>();
  const topicSubjectById = new Map(topics.map((topic) => [topic.id, topic.subjectId]));
  const subjectStats = new Map<string, { total: number; reviewed: Set<string>; correct: number; answered: number }>();
  for (const subject of subjects) subjectStats.set(subject.id, { total: 0, reviewed: new Set(), correct: 0, answered: 0 });
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
  const activity = recentStudyDayKeys(todayKey, 90).map((date) => {
    const [year, month, day] = date.split("-").map(Number);
    const label = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
    return { date, label, sessions: 0, cards: 0 };
  });
  const activityIndex = new Map(activity.map((item, index) => [item.date, index]));
  for (const [cardId, attempts] of mastery.reviewStatsByCard) {
    correctAll += attempts.correct;
    answeredAll += attempts.total;
    const subjectId = cardSubject.get(cardId);
    const subject = subjectId ? subjectStats.get(subjectId) : undefined;
    if (subject) {
      subject.correct += attempts.correct;
      subject.answered += attempts.total;
      if (attempts.total > 0) subject.reviewed.add(cardId);
    }
  }
  for (const { date, count } of reviewActivity) {
    const index = activityIndex.get(date);
    if (index !== undefined) activity[index].cards = count;
  }
  for (const { date, count } of sessionAnalytics.sessionActivity) {
    const index = activityIndex.get(date);
    if (index !== undefined) activity[index].sessions = count;
  }

  const streak = currentConsecutiveDayStreak(mastery.reviewDays, todayKey);

  const subjectPerformance = subjects.map((subject) => {
    const id = subject.id;
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
    const id = topic.id;
    const subjectId = topic.subjectId;
    const stats = mastery.byTopic.get(id);
    return { id, subjectId, subject: subjectNameById.get(subjectId) ?? "Subject", name: topic.name, totalCards: topicCardCounts.get(id) ?? 0, mastered: stats?.mastered ?? 0, usable: stats?.usable ?? 0, progress: stats?.progress ?? 0, completedRequirements: stats?.completedRequirements ?? 0, totalRequirements: stats?.totalRequirements ?? 0 };
  });

  const groupedCardReviews = [...mastery.reviewStatsByCard].map(([id, value]) => ({ _id: id, total: value.total, wrong: value.wrong, latestAt: value.latestReviewedAt?.getTime() ?? 0, latestId: value.latestReviewId ?? "" })).filter((item) => item.total >= 2).sort((a, b) => b.wrong - a.wrong || b.total - a.total || b.latestAt - a.latestAt || b.latestId.localeCompare(a.latestId)).slice(0, 2);
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
  const serializedSessions = sessionAnalytics.recentSessions.map((session) => {
    const type = session.quizType === "multiple-choice" ? "Multiple Choice" : session.quizType === "true-false" ? "True or False" : session.quizType === "identification" ? "Identification" : "Random";
    return { id: session.id, subject: session.subject, type, date: session.date.toISOString(), correct: session.correct, answered: session.answered, accuracy: percent(session.correct, session.answered) };
  });

  const payload: ProgressPayload = {
    summary: { totalReviews: answeredAll, accuracy: percent(correctAll, answeredAll), sessions: sessionAnalytics.sessionCount, streak, masteredCards: mastery.overall.mastered, totalCards: mastery.overall.total, masteryProgress: mastery.overall.progress, completedRequirements: mastery.overall.completedRequirements, totalRequirements: mastery.overall.totalRequirements },
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
          title={<><h1 className="text-2xl font-bold leading-tight text-[#183653] sm:text-3xl xl:text-4xl">Your Learning Journey</h1><p className="abii-page-hero__title-emphasis mt-1 text-3xl font-extrabold leading-tight text-[#F15D8A] sm:text-4xl xl:text-[42px]">Looks Great!</p></>}
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
