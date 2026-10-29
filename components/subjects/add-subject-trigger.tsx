"use client";
import { Plus } from "lucide-react";
export function AddSubjectTrigger({className=""}:{className?:string}){
 return <button type="button" onClick={()=>window.dispatchEvent(new Event("abii:open-add-subject"))} className={className}><Plus className="h-4 w-4" aria-hidden="true"/>Add Subject</button>;
}
