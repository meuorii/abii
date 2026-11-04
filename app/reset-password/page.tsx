import { AuthLayout } from "@/components/auth/auth-layout";
import { AuthFlowForm } from "@/components/auth/auth-flow-form";
import { redirect } from "next/navigation";
import { readResetGrantCookie } from "@/lib/auth/tickets";
import { connectToDatabase } from "@/lib/mongodb";
import { PasswordResetGrant } from "@/models/PasswordResetGrant";
import { hashGrant } from "@/lib/auth/challenges";
export const runtime = "nodejs";
export default async function ResetPasswordPage() {
  const rawGrant = await readResetGrantCookie();
  if (!rawGrant) redirect("/forgot-password");
  await connectToDatabase();
  const grant = await PasswordResetGrant.exists({ tokenHash: hashGrant(rawGrant), expiresAt: { $gt: new Date() }, consumedAt: null });
  if (!grant) redirect("/forgot-password");
  return <AuthLayout mode="reset"><AuthFlowForm mode="reset"/></AuthLayout>;
}
