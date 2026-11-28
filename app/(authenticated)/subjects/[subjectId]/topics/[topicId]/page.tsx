import Link from "next/link";
import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import { notFound, redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { ChevronRight } from "lucide-react";
import { TopicDetailClient } from "@/components/subjects/topic-detail-client";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { Subject } from "@/models/Subject";
import { Topic } from "@/models/Topic";
import { getSubjectMastery } from "@/lib/quiz/service";
import { emptyTypeProgress } from "@/lib/quiz/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ subjectId: string; topicId: string }> };

export default async function TopicPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { subjectId, topicId } = await params;
  if (!isValidObjectId(subjectId) || !isValidObjectId(topicId)) notFound();
  await connectToDatabase();
  const subject = await Subject.findOne({ _id: subjectId, userId: user._id }).select("_id name").lean();
  if (!subject) notFound();
  const [topic, topicDocs, mastery] = await Promise.all([
    Topic.findOne({ _id: topicId, subjectId: subject._id, userId: user._id }).select("_id subjectId name description position createdAt updatedAt").lean(),
    Topic.find({ userId: user._id, subjectId: subject._id }).select("_id name").sort({ position: 1, _id: 1 }).lean(),
    getSubjectMastery(user._id),
  ]);
  if (!topic) notFound();
  const cards = await Flashcard.find({ userId: user._id, subjectId: subject._id, topicId: topic._id })
    .select("_id flashcardType question answer hint createdAt").sort({ createdAt: -1 }).lean();
  const reviewed = mastery.reviewedCardIds;
  const topicMastery = mastery.byTopic.get(String(topic._id)) ?? { total: cards.length, usable: 0, reviewed: 0, mastered: 0, completedRequirements: 0, totalRequirements: 0, due: cards.length, correct: 0, incorrect: 0, progress: 0 };
  const topicTypeMastery = mastery.byTypeByTopic.get(String(topic._id)) ?? emptyTypeProgress();
  return (
    <div className="min-w-0 space-y-5 p-4 pb-24 sm:p-6 xl:p-7">
      <nav aria-label="Breadcrumb" className="abii-enter abii-enter-1 flex min-w-0 flex-wrap items-center gap-2 text-xs sm:text-sm">
        <Link href="/subjects" className="font-medium text-muted hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover">My Subjects</Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted"/>
        <Link href={`/subjects/${subject._id}`} className="max-w-[40vw] truncate font-medium text-muted hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover">{subject.name}</Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted"/>
        <span aria-current="page" className="max-w-[38vw] truncate font-semibold text-foreground">{topic.name}</span>
      </nav>
      <AbiiPageHero
        variant="topic-detail"
        headingId="topic-hero-title"
        title={<><h1 className="abii-hero-heading break-words">{topic.name}</h1><p className="abii-hero-subheading break-words">{subject.name}</p></>}
        description={topic.description ? <p className="max-w-xl break-words">{topic.description}</p> : undefined}
        metadata={<p>{cards.length} {cards.length === 1 ? "flashcard" : "flashcards"}</p>}
        mascotSrc="/dashboard-hero/my-subjects.png"
        mascotAlt=""
        priority
      />
      <TopicDetailClient subjectId={String(subject._id)} subjectName={subject.name} topic={{ id: String(topic._id), name: topic.name, count: cards.length }} mastery={topicMastery} typeMastery={topicTypeMastery} topicOptions={topicDocs.map((item) => ({ id: String(item._id), name: item.name }))} initialCards={cards.map((card) => ({ id: String(card._id), topicId: String(topic._id), topicName: topic.name, flashcardType: card.flashcardType === "items" ? "items" as const : "standard" as const, question: card.question, answer: card.answer, hint: card.hint ?? "", reviewed: reviewed.has(String(card._id)) }))}/>
    </div>
  );
}
