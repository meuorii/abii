import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import Link from "next/link";
import { isValidObjectId } from "mongoose";
import { notFound, redirect } from "next/navigation";
import { TopicsSection } from "@/components/subjects/topics-section";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Subject } from "@/models/Subject";
import { Folder } from "@/models/Folder";
import { Topic } from "@/models/Topic";
import { Flashcard } from "@/models/Flashcard";
import { ChevronRight } from "lucide-react";

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
  return <div className="space-y-4 p-4 pb-24 sm:p-5 xl:p-6">
    <nav aria-label="Breadcrumb" className="abii-enter abii-enter-1 flex min-w-0 items-center gap-1.5 overflow-hidden text-xs sm:gap-2 sm:text-sm"><Link href="/subjects" className="shrink-0 text-muted hover:text-primary-hover">My Subjects</Link><ChevronRight className="h-4 w-4 shrink-0 text-muted"/><Link href={`/subjects/${subject._id}`} title={subject.name} className="min-w-0 truncate text-muted hover:text-primary-hover">{subject.name}</Link><ChevronRight className="h-4 w-4 shrink-0 text-muted"/><span aria-current="page" className="min-w-0 truncate font-semibold text-foreground">{title}</span></nav>
    <AbiiPageHero
      variant="topic-folder"
      headingId="topic-folder-hero-title"
      title={<><h1 className="abii-hero-heading break-words">{title}</h1><p className="abii-hero-subheading break-words">{topicCount} {topicCount === 1 ? "topic" : "topics"} · {flashcardCount} {flashcardCount === 1 ? "flashcard" : "flashcards"}</p></>}
      description={<p className="max-w-sm">{subject.name} · Keep your topics organized and ready for your next study session.</p>}
      mascotSrc="/dashboard-hero/my-subjects.png"
      mascotAlt=""
      priority
    />
    <TopicsSection subjectId={String(subject._id)} folderId={unfiled ? "unfiled" : String(folder!._id)} />
  </div>;
}
