import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { ChevronRight, FolderOpen } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TopicDetailClient } from "@/components/subjects/topic-detail-client";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { ReviewRecord } from "@/models/ReviewRecord";
import { Subject } from "@/models/Subject";
import { Topic } from "@/models/Topic";

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
  const topic = await Topic.findOne({ _id: topicId, subjectId: subject._id, userId: user._id }).select("_id subjectId name description position createdAt updatedAt").lean();
  if (!topic) notFound();
  const cards = await Flashcard.find({ userId: user._id, subjectId: subject._id, topicId: topic._id })
    .select("_id flashcardType question answer hint createdAt").sort({ createdAt: -1 }).lean();
  const cardIds = cards.map((card) => card._id);
  const reviews = cardIds.length ? await ReviewRecord.find({ userId: user._id, flashcardId: { $in: cardIds } }).select("flashcardId").lean() : [];
  const reviewed = new Set(reviews.map((row) => String(row.flashcardId)));
  return <AppShell pageTitle={topic.name} pageDescription="Flashcards in this topic" userName={user.name}>
    <div className="min-w-0 space-y-5 p-4 pb-24 sm:p-6 xl:p-7">
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-2 text-xs sm:text-sm">
        <Link href="/subjects" className="font-medium text-[#71869A] hover:text-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">My Subjects</Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#B4A5AC]"/>
        <Link href={`/subjects/${subject._id}`} className="max-w-[40vw] truncate font-medium text-[#71869A] hover:text-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">{subject.name}</Link>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#B4A5AC]"/>
        <span aria-current="page" className="max-w-[38vw] truncate font-semibold text-[#153B56]">{topic.name}</span>
      </nav>
      <section className="relative isolate overflow-hidden rounded-[1.35rem] border border-[#F7DFE7] bg-[#FFF7F9] p-5 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFE7EE] text-[#E9577D]"><FolderOpen aria-hidden="true" className="h-5 w-5"/></span>
          <h1 className="mt-4 break-words text-[clamp(1.6rem,4vw,2.25rem)] font-bold tracking-[-.04em] text-[#153B56]">{topic.name}</h1>
          <p className="mt-1 text-sm text-[#71869A]">{subject.name}</p>
          {topic.description && <p className="mt-3 max-w-xl break-words text-sm leading-6 text-[#526F83]">{topic.description}</p>}
          <p className="mt-4 text-sm font-semibold text-[#C65380]">{cards.length} {cards.length === 1 ? "flashcard" : "flashcards"}</p>
        </div>
      </section>
      <TopicDetailClient subjectId={String(subject._id)} subjectName={subject.name} topic={{ id: String(topic._id), name: topic.name, count: cards.length }} initialCards={cards.map((card) => ({ id: String(card._id), flashcardType: card.flashcardType === "items" ? "items" as const : "standard" as const, question: card.question, answer: card.answer, hint: card.hint ?? "", reviewed: reviewed.has(String(card._id)) }))}/>
    </div>
  </AppShell>;
}
