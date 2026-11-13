import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/settings/settings-client";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await connectToDatabase();
  const settingsRecord = await (await import("@/models/User")).User.findById(user._id).select("settings").lean();
  if (!settingsRecord) redirect("/login");
  const settings = settingsRecord.settings ?? { targetSubjects: 5, defaultLandingPage: "/dashboard", subjectLayout: "grid", studyTimezone: "UTC" };
  return (
    
      <SettingsClient initialUser={{ settings: { targetSubjects: settings.targetSubjects ?? 5, defaultLandingPage: settings.defaultLandingPage ?? "/dashboard", subjectLayout: settings.subjectLayout ?? "grid", studyTimezone: settings.studyTimezone ?? "UTC" } }} />
    
  );
}
