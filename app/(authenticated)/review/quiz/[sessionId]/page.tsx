import Link from "next/link";
import { redirect } from "next/navigation";
import { QuizSession } from "@/components/review/quiz-session";
import { getCurrentUser } from "@/lib/auth/session";
import { loadSession, sessionMastery, toPublicSession } from "@/lib/quiz/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ sessionId: string }> };

function SessionUnavailable() {
  return (
    <div className="p-4 sm:p-6 xl:p-7">
      <section role="alert" className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Session unavailable</p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">This review session has expired or couldn’t be found.</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Your saved answers are safe. Start a new review whenever you’re ready.</p>
        <Link href="/review/setup" className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2">Start a new review</Link>
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
    session = doc ? toPublicSession(doc, await sessionMastery(user._id, doc)) : null;
  } catch (error) {
    console.error("Quiz session could not be loaded.", error);
  }

  return session && session.questions.length > 0
    ? <QuizSession key={session.id} initial={session} firstName={firstName} />
    : <SessionUnavailable />;
}
