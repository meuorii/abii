import { isValidObjectId } from "mongoose";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { SubjectDetailClient, type SubjectDetailData } from "@/components/subjects/subject-detail-client";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { Subject } from "@/models/Subject";
import { getSubjectMastery } from "@/lib/quiz/service";
import { emptyTypeProgress } from "@/lib/quiz/types";
import { BookOpen, ChevronRight, ArrowRight, CircleCheck } from "lucide-react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ subjectId: string }> };

export default async function SubjectDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { subjectId } = await params;
  if (!isValidObjectId(subjectId)) notFound();

  await connectToDatabase();
  const subject = await Subject.findOne({ _id: subjectId, userId: user._id }).select("_id name").lean();
  if (!subject) notFound();

  const mastery = await getSubjectMastery(user._id);
  const cards = await Flashcard.find({ userId: user._id, subjectId: subject._id })
    .select("_id flashcardType question answer hint createdAt")
    .sort({ createdAt: -1 })
    .lean();
  const cardIds = cards.map((card) => card._id);
  const reviews = cardIds.length
    ? await ReviewRecord.find({ userId: user._id, flashcardId: { $in: cardIds } })
        .select("flashcardId result reviewedAt nextReviewAt")
        .sort({ reviewedAt: -1 })
        .lean()
    : [];

  const latestReview = new Map<string, (typeof reviews)[number]>();
  const reviewedIds = new Set<string>();
  for (const review of reviews) {
    const id = String(review.flashcardId);
    reviewedIds.add(id);
    if (!latestReview.has(id)) latestReview.set(id, review);
  }
  const now = new Date();
  const dueCount = cards.filter((card) => {
    const latest = latestReview.get(String(card._id));
    return !latest || new Date(latest.nextReviewAt).getTime() <= now.getTime();
  }).length;
  const correctCount = reviews.filter((review) => review.result === "correct").length;
  const wrongCount = reviews.filter((review) => review.result === "wrong").length;
  const masteredCount = mastery.bySubject.get(String(subject._id)) ?? 0;
  const typeMastery = mastery.byTypeBySubject.get(String(subject._id)) ?? emptyTypeProgress();
  const progress = cards.length ? Math.round((masteredCount / cards.length) * 100) : 0;

  const data: SubjectDetailData = {
    id: String(subject._id),
    name: subject.name,
    flashcardCount: cards.length,
    reviewedCount: reviewedIds.size,
    masteredCount,
    typeMastery,
    dueCount,
    progress,
    correctCount,
    wrongCount,
    cards: cards.map((card) => ({
      id: String(card._id),
      flashcardType: card.flashcardType === "items" ? "items" as const : "standard" as const,
      question: card.question,
      answer: card.answer,
      hint: card.hint ?? "",
      reviewed: reviewedIds.has(String(card._id)),
    })),
  };
  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  return (
    <AppShell pageTitle={subject.name} pageDescription="Your subject and study cards" userName={user.name}>
      <div className="space-y-3 p-4 pb-24 sm:space-y-4 sm:p-5 sm:pb-24 xl:p-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm">
          <Link href="/subjects" className="font-medium text-[#75889A] transition-colors hover:text-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] rounded">My Subjects</Link>
          <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#B4A5AC]" />
          <span aria-current="page" className="max-w-[55vw] truncate font-semibold text-[#2F2930]">{subject.name}</span>
        </nav>

        <section aria-labelledby="subject-hero-title" className="relative isolate min-h-[270px] overflow-hidden rounded-[1.35rem] border border-[#F5DDE5] bg-[#FFF1F5] sm:min-h-[285px] lg:min-h-[300px]">
          <div className="relative z-10 flex min-h-[270px] items-center sm:min-h-[285px] lg:min-h-[300px]">
            <div className="max-w-[70%] px-5 py-6 sm:max-w-[62%] sm:px-7 sm:py-7 lg:max-w-[60%] lg:px-8">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFE0E9] text-[#E9577D] sm:h-12 sm:w-12"><BookOpen className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><h1 className="truncate text-xl font-bold tracking-[-0.04em] text-[#2F2930] sm:text-2xl">{subject.name}</h1>{cards.length > 0 && masteredCount === cards.length && <span title="Mastered" aria-label="Mastered" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#F7C6D6] bg-[#FFF0F5] px-2 py-1 text-[10px] font-bold text-[#D94675]"><CircleCheck className="h-3 w-3"/>Mastered</span>}</div>
                  <p className="mt-1 text-[11px] text-[#6E8497] sm:text-xs">{cards.length} {cards.length === 1 ? "flashcard" : "flashcards"} <span className="mx-1.5">·</span> {progress}% mastered</p>
                  <div className="mt-2 h-1.5 w-32 overflow-hidden rounded-full bg-white/90 sm:w-48"><div className="h-full rounded-full bg-[#E9577D]" style={{ width: `${progress}%` }} /></div>
                  
                </div>
              </div>
              <h2 id="subject-hero-title" className="mt-5 max-w-[420px] text-[clamp(1.45rem,2.5vw,2rem)] font-bold leading-[1.12] tracking-[-0.045em] text-[#173B52]">One card at a time,<br /><span className="text-[#E9577D]">one step closer.</span></h2>
              <p className="mt-2 max-w-sm text-xs leading-5 text-[#526F83] sm:text-sm sm:leading-6">Keep practicing and build your confidence.</p>
              <Link href={`/review?subjectId=${subject._id}`} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#F05B87] px-5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 sm:min-h-11 sm:px-6 sm:text-sm">Study Subject <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>
            </div>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 flex w-[42%] items-end justify-center sm:w-[40%] lg:w-[39%]">
            <Image src="/dashboard-hero/my-subjects.png" alt="" fill priority sizes="(max-width: 640px) 43vw, 420px" className="object-contain object-bottom" />
          </div>
        </section>

        <SubjectDetailClient initialData={data} />
      </div>
    </AppShell>
  );
}


