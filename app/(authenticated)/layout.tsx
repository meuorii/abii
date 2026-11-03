import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { logServerDuration } from "@/lib/performance/server-timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const startedAt = performance.now();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  logServerDuration("authenticated navigation layout", startedAt);
  return (
    <AppShell
      key={String(user._id)}
      userId={String(user._id)}
      userName={user.name}
      profileImage={user.profileImage ?? ""}
    >
      {children}
    </AppShell>
  );
}
