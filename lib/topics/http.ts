import "server-only";
import mongoose from "mongoose";
import { isDuplicateTopicError } from "../../models/Topic";
import { createTopic, listTopics, getTopic, updateTopic, deleteTopic } from "./service";
import { TopicError, matchVersion } from "./validation";

type Context = { params: Promise<{ subjectId: string; topicId?: string }> };
type Dependencies = { getCurrentUser: () => Promise<{ _id: unknown } | null>; connectToDatabase: () => Promise<unknown> };

/** Shared route boundary; tests inject identity/connection, never persistence. */
export function topicHandlers(dependencies: Dependencies) {
  async function handle(request: Request, context: Context) {
    try {
      const user = await dependencies.getCurrentUser();
      if (!user) throw new TopicError(401, "Please sign in to manage topics.");
      const { subjectId, topicId } = await context.params;
      await dependencies.connectToDatabase();
      const userId = String(user._id);
      if (request.method === "GET") {
        if (!topicId) {
          const url = new URL(request.url);
          const folder = url.searchParams.get("folderId");
          return Response.json({ topics: await listTopics(userId, subjectId, folder === "unfiled" ? null : folder ?? undefined) }, { headers: { "Cache-Control": "no-store" } });
        }
        const topic = await getTopic(userId, subjectId, topicId);
        return Response.json({ topic }, { headers: { ETag: `"${topic.updatedAt}"`, "Cache-Control": "no-store" } });
      }
      let body: unknown;
      try { body = await request.json(); } catch { throw new TopicError(400, "Provide valid JSON."); }
      if (request.method === "POST" && !topicId) {
        const topic = await createTopic(userId, subjectId, body);
        return Response.json({ topic }, { status: 201, headers: { ETag: `"${topic.updatedAt}"` } });
      }
      if (request.method === "PATCH" && topicId) {
        const topic = await updateTopic(userId, subjectId, topicId, body, matchVersion(request.headers.get("If-Match")));
        return Response.json({ topic }, { headers: { ETag: `"${topic.updatedAt}"` } });
      }
      if (request.method === "DELETE" && topicId) return Response.json(await deleteTopic(userId, subjectId, topicId, body, matchVersion(request.headers.get("If-Match"))));
      return Response.json({ error: "Method not allowed." }, { status: 405 });
    } catch (error) {
      if (error instanceof TopicError) return Response.json({ error: error.message }, { status: error.status });
      if (isDuplicateTopicError(error)) return Response.json({ error: "A topic with that name already exists in this subject." }, { status: 409 });
      if (error instanceof mongoose.Error.ValidationError) return Response.json({ error: "Check the topic name, description, and position." }, { status: 400 });
      if (error instanceof mongoose.mongo.MongoServerError && (error.code === 112 || error.hasErrorLabel("TransientTransactionError"))) return Response.json({ error: "Topics changed concurrently. Reload and try again." }, { status: 409 });
      console.error("Topic request failed.", error);
      return Response.json({ error: "We couldn't complete this topic request. Please try again." }, { status: 500 });
    }
  }
  return { GET: handle, POST: handle, PATCH: handle, DELETE: handle };
}
