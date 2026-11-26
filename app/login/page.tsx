import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { getCurrentUser } from "@/lib/auth/session";
import { safeAdminPath, safeNextPath } from "@/lib/auth/redirect";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/auth/admin-session";
import { AdminAccessError, validateAdminSession } from "@/lib/auth/admin-session-state";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; adminReauth?: string; sessionExpired?: string }> }) {
  const [user, params, adminToken] = await Promise.all([getCurrentUser(), searchParams, cookies().then(jar => jar.get(ADMIN_COOKIE)?.value)]);
  if (process.env.ABII_ADMIN_UI_ENABLED === "true" && adminToken) {
    let validAdmin = false;
    try {
      await validateAdminSession(adminToken);
      validAdmin = true;
    } catch (error) {
      if (error instanceof AdminAccessError && error.status === 503) return <AuthLayout mode="login"><div role="alert" className="rounded-xl border border-[#E8DDE1] bg-white p-5 text-sm leading-6 text-[#6F5964]">Abii can’t verify administrator access right now. Please retry in a moment.</div></AuthLayout>;
    }
    if (validAdmin && params.adminReauth !== "1") redirect(safeAdminPath(Array.isArray(params.next) ? params.next[0] : params.next));
  }
  if (user) redirect(safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next));
  const sessionMessage = params.sessionExpired === "1" ? "Your administrator session expired. Sign in again to continue." : params.adminReauth === "1" ? "Confirm your identity with your password and authenticator code." : "";
  return <AuthLayout mode="login"><AuthForm mode="login" initialMessage={sessionMessage} /></AuthLayout>;
}
