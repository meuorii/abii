import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { Subject } from "@/models/Subject";
import { ReviewOverview, type ReviewSubjectItem } from "@/components/review/review-overview";
import { getSubjectMastery } from "@/lib/quiz/service";
import { emptyTypeProgress } from "@/lib/quiz/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewRecordRow = {
  flashcardId: unknown;
  result: "correct" | "wrong";
  reviewedAt: Date;
  nextReviewAt: Date;
};

function dayKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function utcDayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function calculateStreak(reviewDays: Set<string>, now: Date) {
  const today = utcDayStart(now);
  const yesterday = new Date(today.getTime() - 86_400_000);
  let cursor = reviewDays.has(dayKey(today)) ? today : yesterday;
  if (!reviewDays.has(dayKey(cursor))) return 0;
  let streak = 0;
  while (reviewDays.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}

function ReviewLoadError() {
  return (
    <section role="alert" className="rounded-2xl border border-[#F0C7D3] bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C65380]">A little hiccup</p>
      <h2 className="mt-2 text-xl font-semibold text-[#2F2930]">Your review overview couldn’t load.</h2>
      <p className="mt-2 text-sm leading-6 text-[#756B72]">Please check your connection and try again. Your study data hasn’t been changed.</p>
      <Link href="/review" className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-[#FF6F96] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">Try again</Link>
    </section>
  );
}

type PageProps = { searchParams: Promise<{ subjectId?: string | string[] }> };

export default async function ReviewPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  if (subjectId) redirect(`/review/setup?subjectId=${encodeURIComponent(subjectId)}`);

  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  let loadFailed = false;
  let subjects: ReviewSubjectItem[] = [];
  let totalCards = 0;
  let dueCount = 0;
  let reviewedUniqueCount = 0;
  let reviewedTodayUnique = 0;
  let reviewAttemptsToday = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let streak = 0;
  let masteryTotal = 0;

  try {
    await connectToDatabase();
    const userId = user._id;
    const now = new Date();
    const todayStart = utcDayStart(now);
    const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
    const [subjectDocs, cards, mastery] = await Promise.all([
      Subject.find({ userId }).select("_id name").lean(),
      Flashcard.find({ userId }).select("_id subjectId").lean(),
      getSubjectMastery(userId),
    ]);

    totalCards = cards.length;
    masteryTotal = mastery.all;
    const cardIds = cards.map((card) => card._id);
    const records = (cardIds.length
      ? await ReviewRecord.find({ userId, flashcardId: { $in: cardIds } })
          .select("flashcardId result reviewedAt nextReviewAt")
          .sort({ reviewedAt: -1, createdAt: -1 })
          .lean()
      : []) as ReviewRecordRow[];

    const latestByCard = new Map<string, ReviewRecordRow>();
    const reviewedCardIds = new Set<string>();
    const reviewedTodayCardIds = new Set<string>();
    const reviewedDays = new Set<string>();
    const reviewedBySubject = new Map<string, Set<string>>();
    const cardsBySubject = new Map<string, number>();
    const latestSubjectActivity = new Map<string, number>();

    for (const card of cards) {
      const subjectId = String(card.subjectId);
      cardsBySubject.set(subjectId, (cardsBySubject.get(subjectId) ?? 0) + 1);
    }

    for (const record of records) {
      const cardId = String(record.flashcardId);
      if (!latestByCard.has(cardId)) latestByCard.set(cardId, record);
      reviewedCardIds.add(cardId);
      const reviewedAt = new Date(record.reviewedAt);
      if (!Number.isNaN(reviewedAt.getTime())) {
        reviewedDays.add(dayKey(reviewedAt));
        if (reviewedAt >= todayStart && reviewedAt < tomorrowStart) {
          reviewAttemptsToday += 1;
          reviewedTodayCardIds.add(cardId);
        }
      }
      if (record.result === "correct") correctCount += 1;
      if (record.result === "wrong") wrongCount += 1;
    }

    const subjectByCard = new Map(cards.map((card) => [String(card._id), String(card.subjectId)]));
    for (const record of records) {
      const subjectId = subjectByCard.get(String(record.flashcardId));
      if (!subjectId) continue;
      const reviewedAt = new Date(record.reviewedAt).getTime();
      latestSubjectActivity.set(subjectId, Math.max(latestSubjectActivity.get(subjectId) ?? 0, reviewedAt || 0));
      const set = reviewedBySubject.get(subjectId) ?? new Set<string>();
      set.add(String(record.flashcardId));
      reviewedBySubject.set(subjectId, set);
    }

    for (const card of cards) {
      const latest = latestByCard.get(String(card._id));
      if (!latest || new Date(latest.nextReviewAt).getTime() <= now.getTime()) dueCount += 1;
    }

    reviewedUniqueCount = reviewedCardIds.size;
    reviewedTodayUnique = reviewedTodayCardIds.size;
    streak = calculateStreak(reviewedDays, now);

    subjects = subjectDocs
      .map((subject) => {
        const id = String(subject._id);
        const flashcardCount = cardsBySubject.get(id) ?? 0;
        return {
          id,
          name: subject.name,
          flashcardCount,
          progress: flashcardCount ? Math.round(((mastery.bySubject.get(id) ?? 0) / flashcardCount) * 100) : 0,
          lastReviewedAt: latestSubjectActivity.get(id) ?? 0,
          mastered: mastery.bySubject.get(id) ?? 0,
          typeMastery: mastery.byTypeBySubject.get(id) ?? emptyTypeProgress(),
        };
      })
      .filter((subject) => subject.flashcardCount > 0 || subject.name)
      .sort((a, b) => (b.lastReviewedAt - a.lastReviewedAt) || a.name.localeCompare(b.name))
      .slice(0, 4);
  } catch (error) {
    console.error("Review overview data could not be loaded.", error);
    loadFailed = true;
  }

  return (
    <AppShell pageTitle="Review" pageDescription="Review your cards and track progress" userName={user.name}>
      <div className="space-y-6 p-4 sm:p-6 xl:p-7">
        <section aria-labelledby="review-hero-title" className="relative isolate min-h-[225px] overflow-hidden rounded-[1.4rem] border border-[#F5DDE5] bg-[#FFF1F5] sm:min-h-[245px] lg:min-h-[265px]">
          <div className="relative z-10 max-w-[64%] px-5 py-6 sm:max-w-[58%] sm:px-7 sm:py-8 lg:max-w-[57%] lg:px-8 lg:py-8">
            <p className="text-sm font-semibold text-[#C65380]">Keep going, {firstName}! <span aria-hidden="true">👋</span></p>
            <h1 id="review-hero-title" className="mt-3 text-[clamp(1.65rem,3vw,2.35rem)] font-bold leading-[1.12] tracking-[-0.045em] text-[#173B55]">
              Review your cards<br />and make them <span className="text-[#E9577D]">stick!</span>
            </h1>
            <p className="mt-3 max-w-sm text-xs leading-5 text-[#45647A] sm:text-sm sm:leading-6">A little review today helps you remember more tomorrow.</p>
            <Link href="/review/setup" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FF477D] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_10px_rgba(233,87,125,0.14)] transition hover:-translate-y-0.5 hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 sm:min-h-11 sm:px-6">
              Start Review <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-[48%] sm:w-[45%] lg:w-[43%]">
            <Image src="/dashboard-hero/review.png" alt="" fill priority sizes="(max-width: 640px) 48vw, (max-width: 1024px) 45vw, 440px" className="object-contain object-bottom" />
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-14 right-[-1rem] h-36 w-44 rounded-full bg-[#FFE2EB]/80" />
        </section>

        {loadFailed ? <ReviewLoadError /> : (
          <ReviewOverview
            firstName={firstName}
            subjects={subjects}
            totalCards={totalCards}
            totalMastered={masteryTotal}
            dueCount={dueCount}
            reviewedUniqueCount={reviewedUniqueCount}
            reviewedTodayUnique={reviewedTodayUnique}
            reviewAttemptsToday={reviewAttemptsToday}
            correctCount={correctCount}
            wrongCount={wrongCount}
            streak={streak}
          />
        )}
      </div>
    </AppShell>
  );
}



