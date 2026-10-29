export class SubjectFolderError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function folderId(value: string) {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new SubjectFolderError(404, "This subject folder could not be found.");
  return value;
}
export function folderPayload(body: unknown, create = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new SubjectFolderError(400, "Provide a JSON object.");
  const data = body as Record<string, unknown>;
  const allowed = ["name", "description", ...(create ? [] : ["position"])];
  if (!Object.keys(data).length || Object.keys(data).some(key => !allowed.includes(key))) throw new SubjectFolderError(400, "Unsupported or empty subject folder fields.");
  const result: { name?: string; description?: string; position?: number } = {};
  if (create || "name" in data) {
    if (typeof data.name !== "string") throw new SubjectFolderError(400, "Folder name is required.");
    result.name = data.name.normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (!result.name || result.name.length > 100) throw new SubjectFolderError(400, "Use a folder name between 1 and 100 characters.");
  }
  if ("description" in data) {
    if (typeof data.description !== "string" || data.description.length > 500) throw new SubjectFolderError(400, "Description must be at most 500 characters.");
    result.description = data.description.normalize("NFKC").trim();
  }
  if ("position" in data) {
    if (typeof data.position !== "number" || !Number.isSafeInteger(data.position) || data.position < 0) throw new SubjectFolderError(400, "Position must be a nonnegative integer.");
    result.position = data.position;
  }
  return result;
}
export function matchFolderVersion(value: string | null) {
  if (!value) throw new SubjectFolderError(428, "Send the folder ETag in If-Match before changing it.");
  if (!/^"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z"$/.test(value)) throw new SubjectFolderError(400, "Invalid If-Match value.");
  return value.slice(1, -1);
}
