import "server-only";
import mongoose from "mongoose";
import { getCurrentUser } from "../auth/session";
import { connectToDatabase } from "../mongodb";
import { TopicError, matchVersion } from "../topics/validation";
import { listFolders, unfiledSummary, createFolder, changeFolder } from "./service";

type Context = { params: Promise<{ subjectId: string; folderId?: string }> };
export async function handleFolder(request: Request, context: Context) {
  try {
    const user = await getCurrentUser(); if (!user) throw new TopicError(401, "Please sign in to manage folders.");
    const { subjectId, folderId } = await context.params; await connectToDatabase(); const userId = String(user._id);
    if (request.method === "GET") {
      const folders = await listFolders(userId, subjectId);
      if (!folderId) return Response.json({ folders, unfiled: await unfiledSummary(userId, subjectId) }, { headers: { "Cache-Control": "no-store" } });
      const folder = folders.find(f => f.id === folderId.toLowerCase()); if (!folder) throw new TopicError(404, "This folder could not be found.");
      return Response.json({ folder }, { headers: { ETag: `"${folder.updatedAt}"`, "Cache-Control": "no-store" } });
    }
    let body: unknown; try { body = await request.json(); } catch { throw new TopicError(400, "Provide valid JSON."); }
    if (request.method === "POST" && !folderId) { const folder = await createFolder(userId, subjectId, body); return Response.json({ folder }, { status: 201, headers: { ETag: `"${folder.updatedAt}"`, "Cache-Control": "no-store" } }); }
    if ((request.method === "PATCH" || request.method === "DELETE") && folderId) {
      const result = await changeFolder(userId, subjectId, folderId, body, matchVersion(request.headers.get("If-Match")), request.method === "DELETE");
      if ("success" in result) return Response.json(result, { headers: { "Cache-Control": "no-store" } });
      return Response.json({ folder: result }, { headers: { ETag: `"${result.updatedAt}"`, "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  } catch (error) {
    if (error instanceof TopicError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) return Response.json({ error: "A folder with that name already exists in this subject." }, { status: 409 });
    if (error instanceof mongoose.Error.ValidationError) return Response.json({ error: "Check the folder fields." }, { status: 400 });
    if (error instanceof mongoose.mongo.MongoServerError && (error.code === 112 || error.hasErrorLabel("TransientTransactionError"))) return Response.json({ error: "Folders changed concurrently. Reload and try again." }, { status: 409 });
    console.error("Folder request failed.", error); return Response.json({ error: "We couldn't complete this folder request. Please try again." }, { status: 500 });
  }
}
