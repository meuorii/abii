import { redirect } from "next/navigation";
import { getCurrentUser, readSessionUserId } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";
import { LandingPageContent } from "@/components/landing/landing-page-content";

export default async function LandingPage() {
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
