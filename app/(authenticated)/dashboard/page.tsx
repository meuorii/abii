import { redirect } from "next/navigation";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Subject } from "@/models/Subject";
import { getSubjectMastery } from "@/lib/quiz/service";
import { logServerDuration, measureServerOperation } from "@/lib/performance/server-timing";
import { addCalendarDays, currentConsecutiveDayStreak, normalizeStudyTimezone, studyDayGreeting, studyDayKey } from "@/lib/badges/study-day";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubjectSummary = { id: string; name: string; flashcardCount: number; progress: number };

export default async function DashboardPage() {
  const pageStartedAt = performance.now();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const now = new Date();
  const timezone = normalizeStudyTimezone(user.settings?.studyTimezone);

  let subjects: SubjectSummary[] = [];
  let dueCount = 0;
  let totalCards = 0;
  let overallMastery = { progress: 0 };
  let currentStreak = 0;
  let lastSevenDays: { label: string; completed: boolean }[] = [];
  let loadFailed = false;

  try {
    await connectToDatabase();
    const userId = user._id;
    const [subjectDocs, mastery] = await measureServerOperation("dashboard data retrieval", () => Promise.all([
      Subject.find({ userId }).select("_id name").sort({ name: 1 }).lean(),
      getSubjectMastery(userId, undefined, { includeHistory: false, studyTimezone: timezone }),
    ]));
    overallMastery = { progress: mastery.overall.progress };

    const cards = mastery.cardSummaries;
    const studyDays = mastery.reviewDays;
    totalCards = cards.length;
    for (const card of cards) {
      const latest = mastery.latestReviewByCard.get(card.id);
      if (!latest || new Date(latest.nextReviewAt).getTime() <= now.getTime()) dueCount += 1;
    }

    const countBySubject = new Map<string, number>();
    for (const card of cards) {
      const key = card.subjectId;
      countBySubject.set(key, (countBySubject.get(key) ?? 0) + 1);
    }

    subjects = subjectDocs.map((subject) => {
      const id = String(subject._id);
      const count = countBySubject.get(id) ?? 0;
      const masteryStats = mastery.bySubject.get(id);
      return {
        id,
        name: subject.name,
        flashcardCount: count,
        progress: masteryStats?.progress ?? 0,
      };
    });

    const todayKey = studyDayKey(now, timezone);
    currentStreak = currentConsecutiveDayStreak(studyDays, todayKey);
    lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const dayKey = addCalendarDays(todayKey, index - 6);
      const [year, month, day] = dayKey.split("-").map(Number);
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      return { label: ["S", "M", "T", "W", "T", "F", "S"][weekday], completed: studyDays.has(dayKey) };
    });
  } catch (error) {
    console.error("Dashboard overview data could not be loaded.", error);
    loadFailed = true;
  }

  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  logServerDuration("dashboard server rendering", pageStartedAt);
  return (
    
      <DashboardOverview
        firstName={firstName}
        greeting={studyDayGreeting(now, timezone)}
        userId={String(user._id)}
        dueCount={dueCount}
        totalCards={totalCards}
        overallMastery={overallMastery}
        currentStreak={currentStreak}
        lastSevenDays={lastSevenDays}
        subjects={subjects}
        loadFailed={loadFailed}
      />
    
  );
}
