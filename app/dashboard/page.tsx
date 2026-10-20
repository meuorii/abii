import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { Subject } from "@/models/Subject";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubjectSummary = { id: string; name: string; flashcardCount: number; progress: number };

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getCurrentStreak(studyDayKeys: Set<string>, today: Date) {
  const todayKey = dateKey(today);
  const yesterday = new Date(startOfUtcDay(today).getTime() - 24 * 60 * 60 * 1000);
  let cursor = studyDayKeys.has(todayKey) ? startOfUtcDay(today) : yesterday;
  if (!studyDayKeys.has(dateKey(cursor))) return 0;

  let streak = 0;
  while (studyDayKeys.has(dateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let subjects: SubjectSummary[] = [];
  let dueCount = 0;
  let totalCards = 0;
  let currentStreak = 0;
  let lastSevenDays: { label: string; completed: boolean }[] = [];
  let loadFailed = false;

  try {
    await connectToDatabase();
    const userId = user._id;
    const now = new Date();
    const [subjectDocs, cards] = await Promise.all([
      Subject.find({ userId }).select("_id name").sort({ name: 1 }).lean(),
      Flashcard.find({ userId }).select("_id subjectId").lean(),
    ]);

    totalCards = cards.length;
    const cardIds = cards.map((card) => card._id);
    const reviewRecords = cardIds.length
      ? await ReviewRecord.find({ userId, flashcardId: { $in: cardIds } })
          .select("flashcardId result reviewedAt nextReviewAt")
          .sort({ reviewedAt: -1, createdAt: -1 })
          .lean()
      : [];

    const latestReviewByCard = new Map<string, (typeof reviewRecords)[number]>();
    const reviewedCardIdsBySubject = new Map<string, Set<string>>();
    const studyDays = new Set<string>();

    for (const record of reviewRecords) {
      const cardId = String(record.flashcardId);
      if (!latestReviewByCard.has(cardId)) latestReviewByCard.set(cardId, record);
      if (record.reviewedAt instanceof Date) studyDays.add(dateKey(record.reviewedAt));
      else if (record.reviewedAt) studyDays.add(dateKey(new Date(record.reviewedAt)));
    }

    for (const card of cards) {
      const subjectId = String(card.subjectId);
      const reviewed = latestReviewByCard.has(String(card._id));
      if (reviewed) {
        const set = reviewedCardIdsBySubject.get(subjectId) ?? new Set<string>();
        set.add(String(card._id));
        reviewedCardIdsBySubject.set(subjectId, set);
      }
      const latest = latestReviewByCard.get(String(card._id));
      if (!latest || new Date(latest.nextReviewAt).getTime() <= now.getTime()) dueCount += 1;
    }

    const countBySubject = new Map<string, number>();
    for (const card of cards) {
      const key = String(card.subjectId);
      countBySubject.set(key, (countBySubject.get(key) ?? 0) + 1);
    }

    subjects = subjectDocs.map((subject) => {
      const id = String(subject._id);
      const count = countBySubject.get(id) ?? 0;
      const reviewedCount = reviewedCardIdsBySubject.get(id)?.size ?? 0;
      return {
        id,
        name: subject.name,
        flashcardCount: count,
        // Progress means the percentage of this subject's cards with at least one saved review.
        progress: count === 0 ? 0 : Math.round((reviewedCount / count) * 100),
      };
    });

    currentStreak = getCurrentStreak(studyDays, now);
    const todayStart = startOfUtcDay(now);
    lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(todayStart.getTime() - (6 - index) * 24 * 60 * 60 * 1000);
      return { label: ["S", "M", "T", "W", "T", "F", "S"][day.getUTCDay()], completed: studyDays.has(dateKey(day)) };
    });
  } catch (error) {
    console.error("Dashboard overview data could not be loaded.", error);
    loadFailed = true;
  }

  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  return (
    <AppShell userName={user.name}>
      <DashboardOverview
        firstName={firstName}
        dueCount={dueCount}
        totalCards={totalCards}
        currentStreak={currentStreak}
        lastSevenDays={lastSevenDays}
        subjects={subjects}
        loadFailed={loadFailed}
      />
    </AppShell>
  );
}
