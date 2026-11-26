import { redirect } from "next/navigation";
import { getCurrentUser, readSessionUserId } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { LandingPageContent } from "@/components/landing/landing-page-content";
import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/auth/admin-session";
import { AdminAccessError, validateAdminSession } from "@/lib/auth/admin-session-state";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const adminToken = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (process.env.ABII_ADMIN_UI_ENABLED === "true" && adminToken) {
    let validAdmin = false;
    try { await validateAdminSession(adminToken); validAdmin = true; }
    catch (error) {
      if (error instanceof AdminAccessError && error.status === 503) {
        return <main className="grid min-h-dvh place-items-center bg-[#FAF9F7] p-6 text-[#30262B]"><section className="max-w-md rounded-2xl bg-white p-8"><h1 className="text-xl font-semibold">Abii is temporarily unavailable</h1><p className="mt-3 text-sm leading-6 text-[#6F5964]">We couldn’t verify your administrator session. Please try again shortly.</p><Link className="mt-5 inline-flex rounded-xl bg-[#FFE8EF] px-4 py-3 text-sm font-semibold" href="/">Try again</Link></section></main>;
      }
    }
    if (validAdmin) redirect("/admin");
  }
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const legacyId = await readSessionUserId();
  if (legacyId) {
    await connectToDatabase();
    const account = await User.findById(legacyId).select("emailVerifiedAt").lean();
    if (account && !(account.emailVerifiedAt instanceof Date)) redirect("/verify-email");
  }
  return <LandingPageContent />;
}
