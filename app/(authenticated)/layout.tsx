import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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
