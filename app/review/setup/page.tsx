import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReviewSetup } from "@/components/review/review-setup";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { getEligibilityCounts, getSubjectMastery } from "@/lib/quiz/service";
import { QUIZ_MODES, emptyTypeProgress, type QuizMode, type SetupSubject, type SetupTopic } from "@/lib/quiz/types";
import { Flashcard } from "@/models/Flashcard";
import { Subject } from "@/models/Subject";
import { Topic } from "@/models/Topic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ subjectId?: string | string[]; topicId?: string | string[] }> };

export default async function ReviewSetupPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const requested = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const requestedTopicId = Array.isArray(params.topicId) ? params.topicId[0] : params.topicId;
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
    const [subjectDocs, cards, topicDocs, counts, mastery] = await Promise.all([
      Subject.find({ userId }).select("_id name").sort({ name: 1 }).lean(),
      Flashcard.find({ userId }).select("_id subjectId topicId").lean(),
      Topic.find({ userId }).select("_id subjectId name").sort({ position: 1, name: 1 }).lean(),
      getEligibilityCounts(userId),
      getSubjectMastery(userId),
    ]);
    allMastered = mastery.all;
    allTypeMastery = mastery.allByType;
    totalCards = cards.length;
    const cardCounts = new Map<string, number>();
    for (const card of cards) cardCounts.set(String(card.subjectId), (cardCounts.get(String(card.subjectId)) ?? 0) + 1);
    allEligible = counts.all;
    const topicCardCounts = new Map<string, number>();
    for (const card of cards) if (card.topicId) {
      const id = String(card.topicId);
      topicCardCounts.set(id, (topicCardCounts.get(id) ?? 0) + 1);
    }
    const topicsBySubject = new Map<string, SetupTopic[]>();
    for (const topic of topicDocs) {
      const id = String(topic._id);
      const setupTopic: SetupTopic = {
        id, name: topic.name,
        flashcardCount: topicCardCounts.get(id) ?? 0,
        eligible: counts.byTopic.get(id) ?? (Object.fromEntries(QUIZ_MODES.map((t) => [t, 0])) as Record<QuizMode, number>),
      };
      const parentId = String(topic.subjectId);
      topicsBySubject.set(parentId, [...(topicsBySubject.get(parentId) ?? []), setupTopic]);
    }
    subjects = subjectDocs.map((subject) => {
      const id = String(subject._id);
      return {
        id,
        name: subject.name,
        flashcardCount: cardCounts.get(id) ?? 0,
        mastered: mastery.bySubject.get(id) ?? 0,
        typeMastery: mastery.byTypeBySubject.get(id) ?? emptyTypeProgress(),
        eligible: counts.bySubject.get(id) ?? (Object.fromEntries(QUIZ_MODES.map((t) => [t, 0])) as Record<QuizMode, number>),
        topics: topicsBySubject.get(id) ?? [],
      };
    });
  } catch (error) {
    console.error("Review setup data could not be loaded.", error);
    loadFailed = true;
  }

  const requestedTopicSubjectId = requestedTopicId ? subjects.find((subject) => subject.topics.some((topic) => topic.id === requestedTopicId))?.id ?? null : null;
  const validRequestedSubjectId = requested && subjects.some((subject) => subject.id === requested) ? requested : null;
  const initialSubjectId = validRequestedSubjectId ?? requestedTopicSubjectId;
  const initialTopicId = requestedTopicSubjectId && (!validRequestedSubjectId || validRequestedSubjectId === requestedTopicSubjectId) ? requestedTopicId ?? null : null;

  return (
    <AppShell pageTitle="Review" pageDescription="Choose what to review" userName={user.name}>
      <ReviewSetup
        firstName={firstName}
        subjects={subjects}
        allEligible={allEligible}
        totalCards={totalCards}
        allMastered={allMastered}
        allTypeMastery={allTypeMastery}
        initialSubjectId={initialSubjectId}
        initialTopicId={initialTopicId}
        loadFailed={loadFailed}
      />
    </AppShell>
  );
}


