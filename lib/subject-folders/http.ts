import "server-only";
import mongoose from "mongoose";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { SubjectFolderError, matchFolderVersion } from "./validation";
import { changeSubjectFolder, createSubjectFolder, getSubjectFolder, listSubjectFolders } from "./service";

type Context = { params: Promise<{ folderId?: string }> };
export async function handleSubjectFolder(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new SubjectFolderError(401, "Please sign in to manage subject folders.");
    const { folderId } = await context.params;
    await connectToDatabase();
    const userId = String(user._id);
    if (request.method === "GET") {
      const folders = folderId ? [await getSubjectFolder(userId, folderId)] : await listSubjectFolders(userId);
      return Response.json(folderId ? { folder: folders[0] } : { folders }, { headers: { ...(folderId ? { ETag: `"${folders[0].updatedAt}"` } : {}), "Cache-Control": "no-store" } });
    }
    let body: unknown;
    try { body = await request.json(); } catch { throw new SubjectFolderError(400, "Provide valid JSON."); }
    if (request.method === "POST" && !folderId) {
      const folder = await createSubjectFolder(userId, body);
      return Response.json({ folder }, { status: 201, headers: { ETag: `"${folder.updatedAt}"`, "Cache-Control": "no-store" } });
    }
    if ((request.method === "PATCH" || request.method === "DELETE") && folderId) {
      const result = await changeSubjectFolder(userId, folderId, body, matchFolderVersion(request.headers.get("If-Match")), request.method === "DELETE");
      return Response.json("success" in result ? result : { folder: result }, { headers: { ...("updatedAt" in result ? { ETag: `"${result.updatedAt}"` } : {}), "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  } catch (error) {
    if (error instanceof SubjectFolderError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) return Response.json({ error: "A subject folder with that name already exists." }, { status: 409 });
    if (error instanceof mongoose.Error.ValidationError) return Response.json({ error: "Check the folder name, description, and position." }, { status: 400 });
    if (error instanceof mongoose.mongo.MongoServerError && (error.code === 112 || error.hasErrorLabel("TransientTransactionError"))) return Response.json({ error: "Folders changed concurrently. Reload and try again." }, { status: 409 });
    console.error("Subject folder request failed.", error);
    return Response.json({ error: "We couldn't complete this folder request. Please try again." }, { status: error instanceof mongoose.mongo.MongoServerError && (error.code === 20 || error.code === 303) ? 503 : 500 });
  }
}
