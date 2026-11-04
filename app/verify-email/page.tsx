import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthFlowForm } from "@/components/auth/auth-flow-form";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) { const [user, params] = await Promise.all([getCurrentUser(), searchParams]); if (user) redirect("/dashboard"); const candidate = Array.isArray(params.next) ? params.next[0] : params.next; return <AuthLayout mode="verify"><AuthFlowForm mode="verify" nextPath={candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/dashboard"}/></AuthLayout>; }
