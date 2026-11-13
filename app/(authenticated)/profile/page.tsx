import { redirect } from "next/navigation";
import { ProfileClient } from "@/components/profile/profile-client";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const createdAt = user.createdAt ? new Date(user.createdAt) : null;
  const memberSince = createdAt && Number.isFinite(createdAt.getTime())
    ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(createdAt)
    : null;

  return (
    <ProfileClient
      initialUser={{
        name: user.name,
        email: user.email,
        profileImage: user.profileImage ?? "",
        memberSince,
      }}
    />
  );
}
