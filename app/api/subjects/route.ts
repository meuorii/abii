import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Subject } from "@/models/Subject";
import { SubjectFolder } from "@/models/SubjectFolder";
import { recordAchievementEvent } from "@/lib/badges/repository";
import { evaluateAffectedBadges, type NewlyUnlockedBadge } from "@/lib/badges/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to search subjects." }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ subjects: [] }, { headers: { "Cache-Control": "no-store" } });
  if (query.length > 100) return NextResponse.json({ error: "Search must be 100 characters or fewer." }, { status: 400 });
  try {
    await connectToDatabase();
    const escaped = escapeRegex(query);
    const rows = await Subject.find({ userId: user._id, name: { $regex: escaped, $options: "i" } }).select("_id name subjectFolderId").sort({ name: 1 }).limit(25).lean();
    const folderIds = [...new Set(rows.flatMap(row => row.subjectFolderId ? [String(row.subjectFolderId)] : []))];
    const folders = await SubjectFolder.find({ userId: user._id, _id: { $in: folderIds } }).select("_id name").lean();
    const names = new Map(folders.map(folder => [String(folder._id), folder.name]));
    return NextResponse.json({ subjects: rows.map(row => ({ id: String(row._id), name: row.name, folderId: row.subjectFolderId ? String(row.subjectFolderId) : null, folderName: row.subjectFolderId ? names.get(String(row.subjectFolderId)) ?? "Unfiled Subjects" : "Unfiled Subjects" })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Subject search failed.", error);
    return NextResponse.json({ error: "Could not search subjects." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to create a subject." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please enter a valid subject name." }, { status: 400 });
  }

  const rawName = typeof body === "object" && body !== null && "name" in body
    ? (body as { name?: unknown }).name
    : undefined;
  if (typeof rawName !== "string") {
    return NextResponse.json({ error: "Subject name is required." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["name", "subjectFolderId"].includes(key))) return NextResponse.json({ error: "Unsupported subject fields." }, { status: 400 });
  const rawFolderId = "subjectFolderId" in body ? (body as { subjectFolderId?: unknown }).subjectFolderId : null;
  if (rawFolderId !== null && (typeof rawFolderId !== "string" || !/^[a-f\d]{24}$/i.test(rawFolderId))) return NextResponse.json({ error: "Provide a valid subject folder ID." }, { status: 400 });

  const name = rawName.trim();
  if (!name) return NextResponse.json({ error: "Enter a subject name." }, { status: 400 });
  if (name.length > 100) return NextResponse.json({ error: "Use 100 characters or fewer." }, { status: 400 });

  try {
    await connectToDatabase();
    const userId = user._id;
    if (rawFolderId && !await SubjectFolder.exists({ _id: rawFolderId, userId })) return NextResponse.json({ error: "This subject folder could not be found." }, { status: 404 });
    const existing = await Subject.findOne({ userId, name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } }).select("_id").lean();
    if (existing) return NextResponse.json({ error: "You already have a subject with that name." }, { status: 409 });

    const subject = await Subject.create({ userId, name, subjectFolderId: rawFolderId });
    try {
      await recordAchievementEvent(String(userId), { idempotencyKey: `subject-created:${String(subject._id)}`, kind: "subject-created", occurredAt: subject.createdAt ?? new Date(), subjectId: String(subject._id) });
    } catch (eventError) {
      console.error("Subject created but achievement activity could not be recorded; it can be reconciled from subjects.", eventError);
    }
    let newlyUnlockedBadges: NewlyUnlockedBadge[] = [];
    try { newlyUnlockedBadges = await evaluateAffectedBadges(String(userId)); }
    catch (badgeError) { console.error("Subject saved; badge evaluation will retry during reconciliation.", badgeError); }
    return NextResponse.json({ subject: { id: String(subject._id), name: subject.name, subjectFolderId: subject.subjectFolderId ? String(subject.subjectFolderId) : null, flashcardCount: 0, progress: 0 }, newlyUnlockedBadges }, { status: 201 });
  } catch (error) {
    console.error("Subject creation failed.", error);
    return NextResponse.json({ error: "We couldn’t save that subject right now. Please try again." }, { status: 500 });
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
