import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

export const runtime = "nodejs";
const landingPages = new Set(["/dashboard", "/subjects", "/review", "/progress"]);
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to update your settings." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Please check your settings and try again." }, { status: 400 }); }
  const targetSubjects = Number(body.targetSubjects);
  const defaultLandingPage = body.defaultLandingPage;
  const subjectLayout = body.subjectLayout;
  if (!Number.isInteger(targetSubjects) || targetSubjects < 1 || targetSubjects > 100) return NextResponse.json({ error: "Choose a target between 1 and 100 subjects." }, { status: 400 });
  if (typeof defaultLandingPage !== "string" || !landingPages.has(defaultLandingPage)) return NextResponse.json({ error: "Choose a valid default page." }, { status: 400 });
  if (subjectLayout !== "grid" && subjectLayout !== "list") return NextResponse.json({ error: "Choose Grid or List for your subject layout." }, { status: 400 });
  await connectToDatabase();
  await User.updateOne({ _id: user._id }, { $set: { "settings.targetSubjects": targetSubjects, "settings.defaultLandingPage": defaultLandingPage, "settings.subjectLayout": subjectLayout } });
  return NextResponse.json({ message: "Study preferences saved." });
}
