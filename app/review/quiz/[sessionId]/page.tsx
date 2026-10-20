import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { QuizSession } from "@/components/review/quiz-session";
import { getCurrentUser } from "@/lib/auth/session";
import { loadSession, toPublicSession } from "@/lib/quiz/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ sessionId: string }> };

function SessionUnavailable() {
  return (
    <div className="p-4 sm:p-6 xl:p-7">
      <section role="alert" className="rounded-2xl border border-[#F0C7D3] bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C65380]">Session unavailable</p>
        <h2 className="mt-2 text-xl font-semibold text-[#2F2930]">This review session has expired or couldn’t be found.</h2>
        <p className="mt-2 text-sm leading-6 text-[#756B72]">Your saved answers are safe. Start a new review whenever you’re ready.</p>
        <Link href="/review/setup" className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-[#FF6F96] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">Start a new review</Link>
      </section>
    </div>
  );
}

export default async function QuizSessionPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { sessionId } = await params;
  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  let session = null;
  try {
    const doc = await loadSession(user._id, sessionId);
    session = doc ? toPublicSession(doc) : null;
  } catch (error) {
    console.error("Quiz session could not be loaded.", error);
  }

  return (
    <AppShell pageTitle="Review" pageDescription="Active recall quiz" userName={user.name}>
      {session && session.questions.length > 0 ? <QuizSession key={session.id} initial={session} firstName={firstName} /> : <SessionUnavailable />}
    </AppShell>
  );
}
