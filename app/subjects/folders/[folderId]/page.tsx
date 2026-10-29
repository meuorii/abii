import Image from "next/image";
import Link from "next/link";
import { isValidObjectId } from "mongoose";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
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
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Props={params:Promise<{folderId:string}>};
export default async function SubjectFolderPage({params}:Props){
 const user=await getCurrentUser();if(!user)redirect("/login");const {folderId}=await params;const unfiled=folderId==="unfiled";if(!unfiled&&!isValidObjectId(folderId))notFound();await connectToDatabase();
 const folder=unfiled?null:await SubjectFolder.findOne({_id:folderId,userId:user._id}).select("_id name description").lean();if(!unfiled&&!folder)notFound();
 const filter=unfiled?{userId:user._id,$or:[{subjectFolderId:null},{subjectFolderId:{$exists:false}}]}:{userId:user._id,subjectFolderId:folder!._id};
 const [docs,topics,cards,mastery,settings]=await Promise.all([Subject.find(filter).select("_id name").sort({name:1}).lean(),Topic.aggregate<{_id:typeof user._id;count:number}>([{$match:{userId:user._id}},{$group:{_id:"$subjectId",count:{$sum:1}}}]),Flashcard.find({userId:user._id}).select("subjectId").lean(),getSubjectMastery(user._id),User.findById(user._id).select("settings.subjectLayout").lean()]);
 const topicCounts=new Map(topics.map(x=>[String(x._id),x.count])),cardCounts=new Map<string,number>();for(const card of cards){const id=String(card.subjectId);cardCounts.set(id,(cardCounts.get(id)??0)+1);}
 const subjects:SubjectItem[]=docs.map(s=>{const id=String(s._id),m=mastery.bySubject.get(id);return{id,name:s.name,topicCount:topicCounts.get(id)??0,flashcardCount:cardCounts.get(id)??0,usableCount:m?.usable??0,masteredCount:m?.mastered??0,completedRequirements:m?.completedRequirements??0,totalRequirements:m?.totalRequirements??0,typeMastery:mastery.byTypeBySubject.get(id)??emptyTypeProgress(),progress:m?.progress??0};});
 const subjectIds=docs.map(s=>s._id);const [topicCount,flashcardCount]=await Promise.all([Topic.countDocuments({userId:user._id,subjectId:{$in:subjectIds}}),Flashcard.countDocuments({userId:user._id,subjectId:{$in:subjectIds}})]);
 const title=folder?.name??"Unfiled Subjects";
 return <AppShell pageTitle={title} pageDescription="Organize your study materials" userName={user.name}><div className="space-y-5 p-4 pb-24 sm:p-6 xl:p-7"><nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm"><Link href="/subjects" className="shrink-0 text-[#75889A] hover:text-[#E9577D]">My Subjects</Link><ChevronRight className="h-4 w-4 shrink-0 text-[#B4A5AC]"/><span aria-current="page" className="truncate font-semibold text-[#2F2930]">{title}</span></nav>
 <section className="relative isolate min-h-[260px] overflow-hidden rounded-[1.35rem] border border-[#F5DDE5] bg-[#FFF1F5] sm:min-h-[280px]"><div className="relative z-10 flex min-h-[260px] items-center sm:min-h-[280px]"><div className="max-w-[70%] px-5 py-6 sm:max-w-[62%] sm:px-8"><h1 className="break-words text-2xl font-bold text-[#2F2930]">{title}</h1><p className="mt-1 text-xs text-[#6E8497]">{subjects.length} subjects · {topicCount} topics · {flashcardCount} flashcards</p><h2 className="mt-5 max-w-[430px] text-3xl font-bold leading-tight tracking-tight text-[#173B52]">Your subjects,<br/><span className="text-[#E9577D]">one organized space.</span></h2><p className="mt-2 text-sm text-[#526F83]">Keep your subjects together and make every study session count.</p></div></div><div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-[39%]"><Image src="/dashboard-hero/my-subjects.png" alt="" fill priority sizes="(max-width: 640px) 40vw, 420px" className="object-contain object-bottom"/></div></section>
 <SubjectsClient initialSubjects={subjects} initialLayout={settings?.settings?.subjectLayout==="list"?"list":"grid"} subjectFolderId={unfiled?null:String(folder!._id)}/></div></AppShell>;
}
