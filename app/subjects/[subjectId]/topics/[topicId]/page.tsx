import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { ChevronRight, FolderOpen } from "lucide-react";
import { AppShell } from "@/components/app-shell";
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
  return <AppShell pageTitle={topic.name} pageDescription="Flashcards in this topic" userName={user.name}>
    <div className="min-w-0 space-y-5 p-4 pb-24 sm:p-6 xl:p-7">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-2 text-xs sm:text-sm">
        <Link href="/subjects" className="font-medium text-[#71869A] hover:text-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">My Subjects</Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#B4A5AC]"/>
        <Link href={`/subjects/${subject._id}`} className="max-w-[40vw] truncate font-medium text-[#71869A] hover:text-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">{subject.name}</Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#B4A5AC]"/>
        <span aria-current="page" className="max-w-[38vw] truncate font-semibold text-[#153B56]">{topic.name}</span>
      </nav>
      <section aria-labelledby="topic-hero-title" className="relative isolate min-h-[270px] overflow-hidden rounded-[1.35rem] border border-[#F5DDE5] bg-[#FFF1F5] sm:min-h-[285px] lg:min-h-[300px]">
        <div className="relative z-10 flex min-h-[270px] items-center sm:min-h-[285px] lg:min-h-[300px]">
          <div className="w-full max-w-[64%] px-5 py-7 sm:max-w-[62%] sm:px-7 sm:py-8 lg:max-w-[60%] lg:px-8">
            <span aria-hidden="true" className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFE0E9] text-[#E9577D] sm:h-12 sm:w-12"><FolderOpen className="h-5 w-5"/></span>
            <h1 id="topic-hero-title" className="mt-3 break-words text-[clamp(1.45rem,4vw,2.25rem)] font-bold leading-[1.12] tracking-[-.04em] text-[#173B52]">{topic.name}</h1>
            <p className="mt-2 break-words text-sm text-[#6E8497]">{subject.name}</p>
            {topic.description && <p className="mt-3 max-w-xl break-words text-sm leading-6 text-[#526F83]">{topic.description}</p>}
            <p className="mt-4 text-sm font-semibold text-[#C65380]">{cards.length} {cards.length === 1 ? "flashcard" : "flashcards"}</p>
          </div>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 flex w-[36%] items-end justify-center sm:w-[40%] lg:w-[39%]">
          <Image src="/dashboard-hero/my-subjects.png" alt="" fill priority sizes="(max-width: 640px) 43vw, 420px" className="object-contain object-bottom" />
        </div>
      </section>
      <TopicDetailClient subjectId={String(subject._id)} subjectName={subject.name} topic={{ id: String(topic._id), name: topic.name, count: cards.length }} mastery={topicMastery} typeMastery={topicTypeMastery} topicOptions={topicDocs.map((item) => ({ id: String(item._id), name: item.name }))} initialCards={cards.map((card) => ({ id: String(card._id), topicId: String(topic._id), topicName: topic.name, flashcardType: card.flashcardType === "items" ? "items" as const : "standard" as const, question: card.question, answer: card.answer, hint: card.hint ?? "", reviewed: reviewed.has(String(card._id)) }))}/>
    </div>
  </AppShell>;
}
