import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { AdminMfaForm } from "@/components/auth/admin-mfa-form";
import { CHALLENGE_COOKIE } from "@/lib/auth/admin-session";
import { safeAdminPath } from "@/lib/auth/redirect";

export const dynamic = "force-dynamic";
export default async function VerifyAdminPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  if (!(await cookies()).get(CHALLENGE_COOKIE)?.value) redirect("/login");
  return <AuthLayout mode="admin-mfa"><AdminMfaForm next={safeAdminPath((await searchParams).next)} /></AuthLayout>;
}
