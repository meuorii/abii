import { redirect } from "next/navigation";
import Link from "next/link";
import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import type { SubjectItem } from "@/components/subjects/subjects-client";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { Subject } from "@/models/Subject";
import { Topic } from "@/models/Topic";
import { User } from "@/models/User";
import { getSubjectMastery } from "@/lib/quiz/service";
import { emptyTypeProgress } from "@/lib/quiz/types";
import { SubjectFolder } from "@/models/SubjectFolder";
import { SubjectFoldersOverview, type SubjectFolderSummary } from "@/components/subjects/subject-folders-overview";
import { listSubjectFolders } from "@/lib/subject-folders/service";
import { StudyStatistics } from "@/components/subjects/study-statistics";
import { Folder, BookOpen, Layers3, CreditCard } from "lucide-react";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function SubjectLoadError() {
  return (
    <section role="alert" className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">A little hiccup</p>
      <h2 className="mt-2 text-xl font-semibold text-foreground">Your subjects couldn’t load.</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Please check your connection and try again. Your study data hasn’t been changed.</p>
      <Link href="/subjects" className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2">Try again</Link>
    </section>
  );
}

export default async function SubjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let subjects: SubjectItem[] = [];
  let loadFailed = false;
  let preferredLayout: "grid" | "list" = "grid";
  let folderSummaries: SubjectFolderSummary[] = [];
  let unfiledCount = 0;
  let totals = { folders: 0, subjects: 0, topics: 0, flashcards: 0 };

  try {
    await connectToDatabase();
    const userId = user._id;
    const [folderCount, userSettings, totalSubjects, totalTopics, totalFlashcards] = await Promise.all([
      SubjectFolder.countDocuments({ userId }),
      User.findById(userId).select("settings.subjectLayout").lean(),
      Subject.countDocuments({ userId }), Topic.countDocuments({ userId }), Flashcard.countDocuments({ userId }),
    ]);
    totals = { folders: folderCount, subjects: totalSubjects, topics: totalTopics, flashcards: totalFlashcards };
    preferredLayout = userSettings?.settings?.subjectLayout === "list" ? "list" : "grid";
    [folderSummaries, unfiledCount] = await Promise.all([
      listSubjectFolders(String(userId)),
      Subject.countDocuments({ userId, $or: [{ subjectFolderId: null }, { subjectFolderId: { $exists: false } }] }),
    ]);
    {
      const [subjectDocs,cards,topics,mastery]=await Promise.all([
        Subject.find({userId,$or:[{subjectFolderId:null},{subjectFolderId:{$exists:false}}]}).select("_id name").sort({name:1}).lean(),
        Flashcard.aggregate<{_id:typeof userId;count:number}>([{$match:{userId}},{$group:{_id:"$subjectId",count:{$sum:1}}}]),
        Topic.aggregate<{_id:typeof userId;count:number}>([{$match:{userId}},{$group:{_id:"$subjectId",count:{$sum:1}}}]),
        getSubjectMastery(userId),
      ]);
      const counts=new Map(cards.map(row=>[String(row._id),row.count]));
      const topicCounts=new Map(topics.map(row=>[String(row._id),row.count]));
      subjects=subjectDocs.map(subject=>{const id=String(subject._id),stats=mastery.bySubject.get(id);return{id,name:subject.name,flashcardCount:counts.get(id)??0,usableCount:stats?.usable??0,topicCount:topicCounts.get(id)??0,masteredCount:stats?.mastered??0,completedRequirements:stats?.completedRequirements??0,totalRequirements:stats?.totalRequirements??0,typeMastery:mastery.byTypeBySubject.get(id)??emptyTypeProgress(),progress:stats?.progress??0};});
    }
  } catch (error) {
    console.error("My Subjects data could not be loaded.", error);
    loadFailed = true;
  }

  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  return (
    
      <div className="space-y-5 p-4 sm:space-y-7 sm:p-6 xl:p-7">
        <AbiiPageHero
          variant="subjects"
          headingId="subjects-hero-title"
          eyebrow={<p>Hello, {firstName}!</p>}
          title={<h1 className="abii-hero-heading">Your subjects,<br />your <span className="abii-hero-emphasis">progress.</span></h1>}
          description={<p className="max-w-[460px]">Keep your subjects and topics together so each study session is easy to find.</p>}
          mascotSrc="/dashboard-hero/my-subjects.png"
          mascotAlt="Abii the pink otter holding a book"
          priority
        />
        {loadFailed ? <SubjectLoadError /> : <>
          <StudyStatistics label="Study library totals" columns={4} items={[
            { label: "Folders", value: totals.folders, icon: Folder },
            { label: "Subjects", value: totals.subjects, icon: BookOpen },
            { label: "Topics", value: totals.topics, icon: Layers3 },
            { label: "Flashcards", value: totals.flashcards, icon: CreditCard },
          ]} />
          <SubjectFoldersOverview initialFolders={folderSummaries} initialUnfiledCount={unfiledCount} initialUnfiledSubjects={subjects} initialLayout={preferredLayout} />
        </>}
      </div>
    
  );
}
