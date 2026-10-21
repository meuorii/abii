import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReviewSetup } from "@/components/review/review-setup";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { getEligibilityCounts, getSubjectMastery } from "@/lib/quiz/service";
import { QUIZ_MODES, emptyTypeProgress, type QuizMode, type SetupSubject } from "@/lib/quiz/types";
import { Flashcard } from "@/models/Flashcard";
import { Subject } from "@/models/Subject";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ subjectId?: string | string[] }> };

export default async function ReviewSetupPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const requested = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  let subjects: SetupSubject[] = [];
  let allEligible = Object.fromEntries(QUIZ_MODES.map((t) => [t, 0])) as Record<QuizMode, number>;
  let totalCards = 0;
  let allMastered = 0;
  let allTypeMastery = emptyTypeProgress();
  let loadFailed = false;

  try {
    await connectToDatabase();
    const userId = user._id;
    const [subjectDocs, cards, counts, mastery] = await Promise.all([
      Subject.find({ userId }).select("_id name").sort({ name: 1 }).lean(),
      Flashcard.find({ userId }).select("_id subjectId").lean(),
      getEligibilityCounts(userId),
      getSubjectMastery(userId),
    ]);
    allMastered = mastery.all;
    allTypeMastery = mastery.allByType;
    totalCards = cards.length;
    const cardCounts = new Map<string, number>();
    for (const card of cards) cardCounts.set(String(card.subjectId), (cardCounts.get(String(card.subjectId)) ?? 0) + 1);
    allEligible = counts.all;
    subjects = subjectDocs.map((subject) => {
      const id = String(subject._id);
      return {
        id,
        name: subject.name,
        flashcardCount: cardCounts.get(id) ?? 0,
        mastered: mastery.bySubject.get(id) ?? 0,
        typeMastery: mastery.byTypeBySubject.get(id) ?? emptyTypeProgress(),
        eligible: counts.bySubject.get(id) ?? (Object.fromEntries(QUIZ_MODES.map((t) => [t, 0])) as Record<QuizMode, number>),
      };
    });
  } catch (error) {
    console.error("Review setup data could not be loaded.", error);
    loadFailed = true;
  }

  return (
    <AppShell pageTitle="Review" pageDescription="Choose what to review" userName={user.name}>
      <ReviewSetup
        firstName={firstName}
        subjects={subjects}
        allEligible={allEligible}
        totalCards={totalCards}
        allMastered={allMastered}
        allTypeMastery={allTypeMastery}
        initialSubjectId={requested && subjects.some((s) => s.id === requested) ? requested : null}
        loadFailed={loadFailed}
      />
    </AppShell>
  );
}


