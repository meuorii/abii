export class TopicError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function objectId(value: string) {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new TopicError(404, "This resource could not be found.");
  return value;
}

export function topicPayload(body: unknown, creating: boolean) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TopicError(400, "Provide a JSON object.");
  const data = body as Record<string, unknown>;
  const allowed = creating ? ["name", "description", "folderId"] : ["name", "description", "position", "folderId"];
  if (!Object.keys(data).length || Object.keys(data).some((key) => !allowed.includes(key))) throw new TopicError(400, "Unsupported or empty topic fields.");
  const result: { name?: string; description?: string; position?: number; folderId?: string | null } = {};
  if ("folderId" in data) {
    if (data.folderId !== null && (typeof data.folderId !== "string" || !/^[a-f\d]{24}$/i.test(data.folderId))) throw new TopicError(400, "Provide a valid folder ID.");
    result.folderId = data.folderId as string | null;
  }
  if (creating || "name" in data) {
    if (typeof data.name !== "string") throw new TopicError(400, "Topic name is required.");
    const name = data.name.normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (!name || name.length > 100) throw new TopicError(400, "Use a topic name between 1 and 100 characters.");
    result.name = name;
  }
  if ("description" in data) {
    if (typeof data.description !== "string" || data.description.length > 500) throw new TopicError(400, "Description must be a string of at most 500 characters.");
    result.description = data.description.trim();
  }
  if ("position" in data) {
    if (typeof data.position !== "number" || !Number.isSafeInteger(data.position) || data.position < 0) throw new TopicError(400, "Position must be a non-negative integer.");
    result.position = data.position;
  }
  return result;
}

export function deletionPayload(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TopicError(400, "Confirm deletion with a JSON object.");
  const data = body as Record<string, unknown>;
  if (data.confirm !== true || Object.keys(data).some((key) => !["confirm", "destinationTopicId"].includes(key))) throw new TopicError(400, "Deletion requires confirm: true; destructive deletion is unsupported.");
  if ("destinationTopicId" in data && (typeof data.destinationTopicId !== "string" || !/^[a-f\d]{24}$/i.test(data.destinationTopicId))) throw new TopicError(400, "Provide a valid destination topic ID.");
  return data.destinationTopicId as string | undefined;
}

export function matchVersion(header: string | null) {
  if (!header) throw new TopicError(428, "Send the topic ETag in If-Match before changing it.");
  if (!/^"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z"$/.test(header) || Number.isNaN(Date.parse(header.slice(1, -1)))) throw new TopicError(400, "Invalid If-Match value.");
  return header.slice(1, -1);
}
