import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AppShell } from "@/components/app-shell";
import { SubjectsClient, type SubjectItem } from "@/components/subjects/subjects-client";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { Flashcard } from "@/models/Flashcard";
import { Subject } from "@/models/Subject";
import { User } from "@/models/User";
import { getSubjectMastery } from "@/lib/quiz/service";
import { emptyTypeProgress } from "@/lib/quiz/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function SubjectLoadError() {
  return (
    <section role="alert" className="rounded-2xl border border-[#F0C7D3] bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C65380]">A little hiccup</p>
      <h2 className="mt-2 text-xl font-semibold text-[#2F2930]">Your subjects couldn’t load.</h2>
      <p className="mt-2 text-sm leading-6 text-[#756B72]">Please check your connection and try again. Your study data hasn’t been changed.</p>
      <Link href="/subjects" className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-[#FF6F96] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">Try again</Link>
    </section>
  );
}

export default async function SubjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let subjects: SubjectItem[] = [];
  let loadFailed = false;
  let preferredLayout: "grid" | "list" = "grid";

  try {
    await connectToDatabase();
    const userId = user._id;
    const [subjectDocs, cards, mastery, userSettings] = await Promise.all([
      Subject.find({ userId }).select("_id name").sort({ name: 1 }).lean(),
      Flashcard.find({ userId }).select("_id subjectId").lean(),
      getSubjectMastery(userId),
      User.findById(userId).select("settings.subjectLayout").lean(),
    ]);

    preferredLayout = userSettings?.settings?.subjectLayout === "list" ? "list" : "grid";

    const counts = new Map<string, number>();
    for (const card of cards) {
      const subjectId = String(card.subjectId);
      counts.set(subjectId, (counts.get(subjectId) ?? 0) + 1);
    }

    subjects = subjectDocs.map((subject) => {
      const id = String(subject._id);
      const flashcardCount = counts.get(id) ?? 0;
      const masteredCount = mastery.bySubject.get(id) ?? 0;
      return {
        id,
        name: subject.name,
        flashcardCount,
        masteredCount,
        typeMastery: mastery.byTypeBySubject.get(id) ?? emptyTypeProgress(),
        progress: flashcardCount === 0 ? 0 : Math.round((masteredCount / flashcardCount) * 100),
      };
    });
  } catch (error) {
    console.error("My Subjects data could not be loaded.", error);
    loadFailed = true;
  }

  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  return (
    <AppShell pageTitle="My Subjects" pageDescription="Organize your study cards" userName={user.name}>
      <div className="space-y-7 p-4 sm:p-6 xl:p-7">
        <section
          aria-labelledby="subjects-hero-title"
          className="relative isolate min-h-[236px] overflow-hidden rounded-[1.15rem] border border-[#F7DFE7] bg-[#FFF0F5] sm:min-h-[238px] lg:min-h-[242px]"
        >
          <div className="relative z-10 flex min-h-[236px] items-center sm:min-h-[238px] lg:min-h-[242px]">
            <div className="w-full max-w-[66%] px-5 py-7 sm:max-w-[61%] sm:px-8 sm:py-8 lg:max-w-[59%] lg:px-9">
              <p className="text-sm font-semibold tracking-[-0.01em] text-[#24445A] sm:text-[15px]">
                Hello, {firstName}! <span aria-hidden="true">👋</span>
              </p>
              <h1
                id="subjects-hero-title"
                className="mt-2.5 text-[clamp(1.85rem,3vw,2.55rem)] font-bold leading-[1.12] tracking-[-0.045em] text-[#18384D]"
              >
                Your subjects,<br />
                your <span className="text-[#F06491]">progress.</span>
              </h1>
              <p className="mt-3 max-w-[390px] text-[13px] leading-[1.65] text-[#557187] sm:text-[15px] sm:leading-[1.6]">
                Organize your flashcards, review regularly,<br className="hidden lg:block" /> and make it happen!
              </p>
            </div>
            <div className="pointer-events-none absolute bottom-0 right-0 h-[88%] w-[48%] sm:h-full sm:w-[45%] lg:w-[43%]">
              <Image
                src="/dashboard-hero/my-subjects.png"
                alt="Abii the pink otter holding a book"
                fill
                priority
                sizes="(max-width: 640px) 48vw, (max-width: 1024px) 45vw, 460px"
                className="object-contain object-[right_bottom]"
              />
            </div>
          </div>
        </section>
        {loadFailed ? <SubjectLoadError /> : <SubjectsClient initialSubjects={subjects} initialLayout={preferredLayout} />}
      </div>
    </AppShell>
  );
}
