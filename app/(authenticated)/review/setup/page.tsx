import { redirect } from "next/navigation";
import { ReviewSetup } from "@/components/review/review-setup";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { getEligibilityCounts, getSubjectMastery } from "@/lib/quiz/service";
import { QUIZ_MODES, emptyTypeProgress, type QuizMode, type SetupSubject, type SetupTopic } from "@/lib/quiz/types";
import { Flashcard } from "@/models/Flashcard";
import { Subject } from "@/models/Subject";
import { Topic } from "@/models/Topic";
import { measureServerOperation, withServerPagePerformanceTrace } from "@/lib/performance/server-timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ subjectId?: string | string[]; topicId?: string | string[]; reviewFilter?: string | string[] }> };

export default function ReviewSetupPage(props: PageProps) {
  return withServerPagePerformanceTrace("review.setup", () => renderReviewSetupPage(props));
}

async function renderReviewSetupPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const requested = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const requestedTopicId = Array.isArray(params.topicId) ? params.topicId[0] : params.topicId;
  const requestedFilter = Array.isArray(params.reviewFilter) ? params.reviewFilter[0] : params.reviewFilter;
  const initialReviewFilter = requestedFilter === "due" ? "due" : "all";
  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  let subjects: SetupSubject[] = [];
  let allEligible = Object.fromEntries(QUIZ_MODES.map((t) => [t, 0])) as Record<QuizMode, number>;
  let allDueEligible = Object.fromEntries(QUIZ_MODES.map((t) => [t, 0])) as Record<QuizMode, number>;
  let allDueCardCount = 0;
  let totalCards = 0;
  let allProgress = 0;
  let allTypeMastery = emptyTypeProgress();
  let loadFailed = false;

  try {
    await connectToDatabase();
    const userId = user._id;
    const [subjectDocs, cards, topicDocs, counts, mastery] = await Promise.all([
      measureServerOperation("review setup subject query", () => Subject.find({ userId }).select("_id name").sort({ name: 1 }).lean(), { database: true }),
      measureServerOperation("review setup card count query", () => Flashcard.find({ userId }).select("_id subjectId topicId").lean(), { database: true }),
      measureServerOperation("review setup topic query", () => Topic.find({ userId }).select("_id subjectId name").sort({ position: 1, name: 1 }).lean(), { database: true }),
      measureServerOperation("review setup eligibility calculation", () => getEligibilityCounts(userId)),
      getSubjectMastery(userId),
    ]);
    allProgress = mastery.overall.progress;
    allTypeMastery = mastery.allByType;
    totalCards = cards.length;
    allDueEligible = counts.due.all;
    allDueCardCount = counts.dueCardCount;
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
        mastered: mastery.byTopic.get(id)?.mastered ?? 0,
        usableCount: mastery.byTopic.get(id)?.usable ?? 0,
        masteryProgress: mastery.byTopic.get(id)?.progress ?? 0,
        completedRequirements: mastery.byTopic.get(id)?.completedRequirements ?? 0,
        totalRequirements: mastery.byTopic.get(id)?.totalRequirements ?? 0,
        eligible: counts.byTopic.get(id) ?? (Object.fromEntries(QUIZ_MODES.map((t) => [t, 0])) as Record<QuizMode, number>),
        dueEligible: counts.due.byTopic.get(id) ?? (Object.fromEntries(QUIZ_MODES.map((t) => [t, 0])) as Record<QuizMode, number>),
        dueCardCount: counts.dueByTopic.get(id) ?? 0,
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
        mastered: mastery.bySubject.get(id)?.mastered ?? 0,
        usableCount: mastery.bySubject.get(id)?.usable ?? 0,
        masteryProgress: mastery.bySubject.get(id)?.progress ?? 0,
        completedRequirements: mastery.bySubject.get(id)?.completedRequirements ?? 0,
        totalRequirements: mastery.bySubject.get(id)?.totalRequirements ?? 0,
        typeMastery: mastery.byTypeBySubject.get(id) ?? emptyTypeProgress(),
        eligible: counts.bySubject.get(id) ?? (Object.fromEntries(QUIZ_MODES.map((t) => [t, 0])) as Record<QuizMode, number>),
        dueEligible: counts.due.bySubject.get(id) ?? (Object.fromEntries(QUIZ_MODES.map((t) => [t, 0])) as Record<QuizMode, number>),
        dueCardCount: counts.dueBySubject.get(id) ?? 0,
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
    
      <ReviewSetup
        firstName={firstName}
        subjects={subjects}
        allEligible={allEligible}
        allDueEligible={allDueEligible}
        allDueCardCount={allDueCardCount}
        totalCards={totalCards}
        allProgress={allProgress}
        allTypeMastery={allTypeMastery}
        initialSubjectId={initialSubjectId}
        initialTopicId={initialTopicId}
        initialReviewFilter={initialReviewFilter}
        loadFailed={loadFailed}
      />
    
  );
}


