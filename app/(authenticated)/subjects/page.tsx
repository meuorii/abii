import { redirect } from "next/navigation";
import Link from "next/link";
import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import { SubjectsClient, type SubjectItem } from "@/components/subjects/subjects-client";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function SubjectLoadError() {
  return (
    <section role="alert" className="rounded-2xl border border-[#F0C7D3] bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C65380]">A little hiccup</p>
      <h2 className="mt-2 text-xl font-semibold text-[#2F2930]">Your subjects couldn’t load.</h2>
      <p className="mt-2 text-sm leading-6 text-[#756B72]">Please check your connection and try again. Your study data hasn’t been changed.</p>
      <Link href="/subjects" className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-[#FF6F96] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">Try again</Link>
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

  try {
    await connectToDatabase();
    const userId = user._id;
    const [folderDocs,userSettings] = await Promise.all([
      SubjectFolder.find({ userId }).select("_id").limit(1).lean(),
      User.findById(userId).select("settings.subjectLayout").lean(),
    ]);
    preferredLayout = userSettings?.settings?.subjectLayout === "list" ? "list" : "grid";
    if(folderDocs.length){
      [folderSummaries,unfiledCount]=await Promise.all([
        listSubjectFolders(String(userId)),
        Subject.countDocuments({userId,$or:[{subjectFolderId:null},{subjectFolderId:{$exists:false}}]}),
      ]);
    }else{
      const [subjectDocs,cards,topics,mastery]=await Promise.all([
        Subject.find({userId}).select("_id name").sort({name:1}).lean(),
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
          eyebrow={<p className="text-sm font-semibold tracking-[-0.01em] text-[#24445A] sm:text-[15px]">Hello, {firstName}! <span aria-hidden="true">👋</span></p>}
          title={<h1 className="mt-2.5 text-[clamp(1.85rem,3vw,2.55rem)] font-bold leading-[1.12] tracking-[-0.045em] text-[#18384D]">Your subjects,<br />your <span className="text-[#F06491]">progress.</span></h1>}
          description={<p className="mt-3 max-w-[390px] text-[13px] leading-[1.65] text-[#557187] sm:text-[15px] sm:leading-[1.6]">Organize your flashcards, review regularly,<br className="hidden lg:block" /> and make it happen!</p>}
          mascotSrc="/dashboard-hero/my-subjects.png"
          mascotAlt="Abii the pink otter holding a book"
          priority
        />
        {loadFailed ? <SubjectLoadError /> : folderSummaries.length ? <SubjectFoldersOverview initialFolders={folderSummaries} initialUnfiledCount={unfiledCount} /> : <SubjectsClient initialSubjects={subjects} initialLayout={preferredLayout} />}
      </div>
    
  );
}
