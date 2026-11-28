import { isValidObjectId } from "mongoose";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import { SubjectDetailClient, type SubjectDetailData } from "@/components/subjects/subject-detail-client";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { Subject } from "@/models/Subject";
import { Topic } from "@/models/Topic";
import { getSubjectMastery } from "@/lib/quiz/service";
import { emptyTypeProgress } from "@/lib/quiz/types";
import { ChevronRight } from "lucide-react";

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

  const mastery = await getSubjectMastery(user._id, [subject._id]);
  const [topicDocs, cards] = await Promise.all([
    Topic.find({ userId: user._id, subjectId: subject._id }).select("_id name").sort({ position: 1, _id: 1 }).lean(),
    Flashcard.find({ userId: user._id, subjectId: subject._id }).select("_id topicId flashcardType question answer hint createdAt")
    .sort({ createdAt: -1 })
    .lean(),
  ]);
  const topicNames = new Map(topicDocs.map((topic) => [String(topic._id), topic.name]));
  const reviewedIds = mastery.reviewedCardIds;
  const masteryStats = mastery.bySubject.get(String(subject._id));
  const dueCount = masteryStats?.due ?? cards.length;
  const correctCount = masteryStats?.correct ?? 0;
  const wrongCount = masteryStats?.incorrect ?? 0;
  const masteredCount = masteryStats?.mastered ?? 0;
  const typeMastery = mastery.byTypeBySubject.get(String(subject._id)) ?? emptyTypeProgress();
  const progress = masteryStats?.progress ?? 0;

  const data: SubjectDetailData = {
    id: String(subject._id),
    name: subject.name,
    flashcardCount: cards.length,
    reviewedCount: reviewedIds.size,
    masteredCount,
    usableCount: masteryStats?.usable ?? 0,
    completedRequirements: masteryStats?.completedRequirements ?? 0,
    totalRequirements: masteryStats?.totalRequirements ?? 0,
    typeMastery,
    dueCount,
    progress,
    correctCount,
    wrongCount,
    topics: topicDocs.map((topic) => {
      const topicStats = mastery.byTopic.get(String(topic._id));
      return { id: String(topic._id), name: topic.name, progress: topicStats?.progress ?? 0, mastered: topicStats?.mastered ?? 0, total: topicStats?.total ?? 0 };
    }),
    cards: cards.map((card) => ({
      id: String(card._id),
      topicId: card.topicId ? String(card.topicId) : null,
      topicName: card.topicId ? topicNames.get(String(card.topicId)) ?? null : null,
      flashcardType: card.flashcardType === "items" ? "items" as const : "standard" as const,
      question: card.question,
      answer: card.answer,
      hint: card.hint ?? "",
      reviewed: reviewedIds.has(String(card._id)),
    })),
  };
  return (
    
      <div className="space-y-3 p-4 pb-24 sm:space-y-4 sm:p-5 sm:pb-24 xl:p-6">
        <nav aria-label="Breadcrumb" className="abii-enter abii-enter-1 flex items-center gap-2 text-xs sm:text-sm">
          <Link href="/subjects" className="font-medium text-muted transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover rounded">My Subjects</Link>
          <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted" />
          <span aria-current="page" className="max-w-[55vw] truncate font-semibold text-foreground">{subject.name}</span>
        </nav>

        <AbiiPageHero
          variant="subject-detail"
          headingId="subject-hero-title"
          title={<h1 className="abii-hero-heading break-words">{subject.name}</h1>}
          description={<p className="max-w-sm">Keep practicing and build your confidence.</p>}
          mascotSrc="/dashboard-hero/my-subjects.png"
          mascotAlt=""
          priority
        />

    <SubjectDetailClient initialData={data} />
      </div>
    
  );
}


