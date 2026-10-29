import { handleSubjectFolder } from "@/lib/subject-folders/http";
export const runtime = "nodejs";
export const GET = (request: Request) => handleSubjectFolder(request);
export const POST = (request: Request) => handleSubjectFolder(request);
