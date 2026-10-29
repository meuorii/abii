import { handleSubjectFolder } from "@/lib/subject-folders/http";
export const runtime = "nodejs";
type RouteContext = { params: Promise<{ folderId: string }> };
export const GET = (request: Request, context: RouteContext) => handleSubjectFolder(request, context);
export const PATCH = (request: Request, context: RouteContext) => handleSubjectFolder(request, context);
export const DELETE = (request: Request, context: RouteContext) => handleSubjectFolder(request, context);
