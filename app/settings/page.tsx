import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SettingsClient } from "@/components/settings/settings-client";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await connectToDatabase();
  const safeUser = await (await import("@/models/User")).User.findById(user._id).select("name email settings createdAt profileImage").lean();
  if (!safeUser) redirect("/login");
  const settings = safeUser.settings ?? { targetSubjects: 5, defaultLandingPage: "/dashboard", subjectLayout: "grid" };
  return (
    <AppShell pageTitle="Settings" pageDescription="Make Abii feel like yours" userName={safeUser.name}>
      <SettingsClient initialUser={{ name: safeUser.name, email: safeUser.email, profileImage: safeUser.profileImage ?? "", createdAt: safeUser.createdAt?.toISOString() ?? "", settings: { targetSubjects: settings.targetSubjects ?? 5, defaultLandingPage: settings.defaultLandingPage ?? "/dashboard", subjectLayout: settings.subjectLayout ?? "grid" } }} />
    </AppShell>
  );
}
