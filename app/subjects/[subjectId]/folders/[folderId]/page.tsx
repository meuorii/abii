import Image from "next/image";
import Link from "next/link";
import { isValidObjectId } from "mongoose";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TopicsSection } from "@/components/subjects/topics-section";
import { FolderAddTopicButton } from "@/components/subjects/folder-add-topic-button";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Subject } from "@/models/Subject";
import { Folder } from "@/models/Folder";
import { Topic } from "@/models/Topic";
import { Flashcard } from "@/models/Flashcard";
import { ChevronRight, FolderOpen } from "lucide-react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ subjectId: string; folderId: string }> };

export default async function FolderDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { subjectId, folderId } = await params;
  if (!isValidObjectId(subjectId)) notFound();
  await connectToDatabase();
  const subject = await Subject.findOne({ _id: subjectId, userId: user._id }).select("_id name").lean();
  if (!subject) notFound();
  const unfiled = folderId === "unfiled";
  if (!unfiled && !isValidObjectId(folderId)) notFound();
  const folder = unfiled ? null : await Folder.findOne({ _id: folderId, subjectId: subject._id, userId: user._id }).select("_id name description").lean();
  if (!unfiled && !folder) notFound();
  const topicFilter = unfiled ? { userId: user._id, subjectId: subject._id, $or: [{ folderId: null }, { folderId: { $exists: false } }] } : { userId: user._id, subjectId: subject._id, folderId: folder!._id };
  const topicIds = await Topic.find(topicFilter).distinct("_id");
  const [topicCount, flashcardCount] = await Promise.all([Topic.countDocuments(topicFilter), Flashcard.countDocuments({ userId: user._id, subjectId: subject._id, topicId: { $in: topicIds } })]);
  const title = folder?.name ?? "Unfiled Topics";
  return <AppShell pageTitle={title} pageDescription={`${subject.name} topics`} userName={user.name}><div className="space-y-4 p-4 pb-24 sm:p-5 xl:p-6">
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs sm:gap-2 sm:text-sm"><Link href="/subjects" className="shrink-0 text-[#75889A] hover:text-[#E9577D]">My Subjects</Link><ChevronRight className="h-4 w-4 shrink-0 text-[#B4A5AC]"/><Link href={`/subjects/${subject._id}`} title={subject.name} className="min-w-0 truncate text-[#75889A] hover:text-[#E9577D]">{subject.name}</Link><ChevronRight className="h-4 w-4 shrink-0 text-[#B4A5AC]"/><span aria-current="page" className="min-w-0 truncate font-semibold text-[#2F2930]">{title}</span></nav>
    <section className="relative isolate min-h-[270px] overflow-hidden rounded-[1.35rem] border border-[#F5DDE5] bg-[#FFF1F5] sm:min-h-[285px] lg:min-h-[300px]"><div className="relative z-10 flex min-h-[270px] items-center sm:min-h-[285px] lg:min-h-[300px]"><div className="max-w-[72%] px-5 py-6 sm:max-w-[62%] sm:px-7 lg:px-8"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFE0E9] text-[#E9577D] sm:h-12 sm:w-12"><FolderOpen className="h-5 w-5"/></span><div className="min-w-0"><h1 className="break-words text-xl font-bold tracking-[-0.04em] text-[#2F2930] sm:text-2xl">{title}</h1><p className="mt-1 text-[11px] text-[#6E8497] sm:text-xs">{topicCount} {topicCount === 1 ? "topic" : "topics"}<span className="mx-1.5">·</span>{flashcardCount} {flashcardCount === 1 ? "flashcard" : "flashcards"}</p></div></div><h2 className="mt-5 max-w-[420px] text-[clamp(1.45rem,2.5vw,2rem)] font-bold leading-[1.12] tracking-[-0.045em] text-[#173B52]">Your lessons,<br/><span className="text-[#E9577D]">perfectly organized.</span></h2><p className="mt-2 max-w-sm text-xs leading-5 text-[#526F83] sm:text-sm sm:leading-6">Keep your topics organized and ready for your next study session.</p><FolderAddTopicButton/></div></div><div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 flex w-[38%] items-end justify-center sm:w-[40%]"><Image src="/dashboard-hero/my-subjects.png" alt="" fill priority sizes="(max-width: 640px) 40vw, 420px" className="object-contain object-bottom"/></div></section>
    <TopicsSection subjectId={String(subject._id)} folderId={unfiled ? "unfiled" : String(folder!._id)} />
  </div></AppShell>;
}
