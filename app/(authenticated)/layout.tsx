import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser, readSessionUserId } from "@/lib/auth/session";
import { User } from "@/models/User";
import { connectToDatabase } from "@/lib/mongodb";
import { logServerDuration } from "@/lib/performance/server-timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const startedAt = performance.now();
  const user = await getCurrentUser();
  if (!user) {
    const signedUserId = await readSessionUserId();
    if (signedUserId) {
      await connectToDatabase();
      const legacyAccount = await User.findById(signedUserId).select("emailVerifiedAt").lean();
      if (legacyAccount && !(legacyAccount.emailVerifiedAt instanceof Date)) redirect("/verify-email");
    }
    redirect("/login");
  }

  logServerDuration("authenticated navigation layout", startedAt);
  return (
    <AppShell
      key={String(user._id)}
      userId={String(user._id)}
      userName={user.name}
      profileImage={user.profileImage ?? ""}
      studyTimezone={user.settings?.studyTimezone ?? "UTC"}
    >
      {children}
    </AppShell>
  );
}
