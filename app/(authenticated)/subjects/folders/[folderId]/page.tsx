import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import Link from "next/link";
import { isValidObjectId } from "mongoose";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SubjectsClient, type SubjectItem } from "@/components/subjects/subjects-client";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Subject } from "@/models/Subject";
import { SubjectFolder } from "@/models/SubjectFolder";
import { Topic } from "@/models/Topic";
import { Flashcard } from "@/models/Flashcard";
import { User } from "@/models/User";
import { getSubjectMastery } from "@/lib/quiz/service";
import { emptyTypeProgress } from "@/lib/quiz/types";
import { listSubjectFolders } from "@/lib/subject-folders/service";
import { StudyStatistics } from "@/components/subjects/study-statistics";
import { BookOpen, Layers3, CreditCard } from "lucide-react";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Props={params:Promise<{folderId:string}>};
export default async function SubjectFolderPage({params}:Props){
 const user=await getCurrentUser();if(!user)redirect("/login");const {folderId}=await params;const unfiled=folderId==="unfiled";if(!unfiled&&!isValidObjectId(folderId))notFound();await connectToDatabase();
 const folder=unfiled?null:await SubjectFolder.findOne({_id:folderId,userId:user._id}).select("_id name description").lean();if(!unfiled&&!folder)notFound();
 const filter=unfiled?{userId:user._id,$or:[{subjectFolderId:null},{subjectFolderId:{$exists:false}}]}:{userId:user._id,subjectFolderId:folder!._id};
 const [docs,settings,subjectFolders]=await Promise.all([Subject.find(filter).select("_id name").sort({name:1}).lean(),User.findById(user._id).select("settings.subjectLayout").lean(),listSubjectFolders(String(user._id))]);
 const subjectIds=docs.map(s=>s._id);
 const [topics,cards,mastery]=await Promise.all([Topic.aggregate<{_id:typeof user._id;count:number}>([{$match:{userId:user._id,subjectId:{$in:subjectIds}}},{$group:{_id:"$subjectId",count:{$sum:1}}}]),Flashcard.aggregate<{_id:typeof user._id;count:number}>([{$match:{userId:user._id,subjectId:{$in:subjectIds}}},{$group:{_id:"$subjectId",count:{$sum:1}}}]),getSubjectMastery(user._id,subjectIds)]);
 const topicCounts=new Map(topics.map(x=>[String(x._id),x.count])),cardCounts=new Map(cards.map(x=>[String(x._id),x.count]));
 const subjects:SubjectItem[]=docs.map(s=>{const id=String(s._id),m=mastery.bySubject.get(id);return{id,name:s.name,topicCount:topicCounts.get(id)??0,flashcardCount:cardCounts.get(id)??0,usableCount:m?.usable??0,masteredCount:m?.mastered??0,completedRequirements:m?.completedRequirements??0,totalRequirements:m?.totalRequirements??0,typeMastery:mastery.byTypeBySubject.get(id)??emptyTypeProgress(),progress:m?.progress??0};});
 const title=folder?.name??"Unfiled Subjects";
 const folderTopicCount=topics.reduce((sum,row)=>sum+row.count,0),folderFlashcardCount=cards.reduce((sum,row)=>sum+row.count,0);
 return <div className="space-y-5 p-4 pb-24 sm:p-6 xl:p-7"><nav aria-label="Breadcrumb" className="abii-enter abii-enter-1 flex min-w-0 items-center gap-2 text-sm"><Link href="/subjects" className="shrink-0 text-muted hover:text-primary-hover">My Subjects</Link><ChevronRight className="h-4 w-4 shrink-0 text-muted"/><span aria-current="page" className="truncate font-semibold text-foreground">{title}</span></nav>
 <AbiiPageHero
   variant="subject-folder"
   headingId="subject-folder-hero-title"
   title={<h1 className="abii-hero-heading break-words">{title}</h1>}
   description={<p>Keep your subjects together and make every study session count.</p>}
   mascotSrc="/dashboard-hero/my-subjects.png"
   mascotAlt=""
   priority
 />
 <StudyStatistics label="Folder statistics" columns={3} items={[{label:"Subjects",value:subjects.length,icon:BookOpen},{label:"Topics",value:folderTopicCount,icon:Layers3},{label:"Flashcards",value:folderFlashcardCount,icon:CreditCard}]}/>
 <SubjectsClient initialSubjects={subjects} initialLayout={settings?.settings?.subjectLayout==="list"?"list":"grid"} subjectFolderId={unfiled?null:String(folder!._id)} subjectFolders={subjectFolders} folderDetail/></div>;
}
