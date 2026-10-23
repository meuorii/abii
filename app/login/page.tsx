import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  if (user) redirect(safeNextPath(Array.isArray(params.next) ? params.next[0] : params.next));
  return <AuthLayout mode="login"><AuthForm mode="login" /></AuthLayout>;
}
