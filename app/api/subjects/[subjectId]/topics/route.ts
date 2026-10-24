import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { getSubjectMastery } from "@/lib/quiz/service";
import { topicHandlers } from "@/lib/topics/http";
import type { MasteryStats } from "@/lib/quiz/types";

export const runtime = "nodejs";
const handlers = topicHandlers({ getCurrentUser, connectToDatabase });

function withMastery<T extends { id: string; flashcardCount: number; metrics?: Record<string, unknown> }>(topic: T, stats: MasteryStats | undefined) {
  if (!stats) return topic;
  return {
    ...topic,
    usableFlashcardCount: stats.usable,
    masteredCount: stats.mastered,
    progress: stats.progress,
    metrics: { ...topic.metrics, usableFlashcardCount: stats.usable, reviewedFlashcardCount: stats.reviewed, masteredFlashcardCount: stats.mastered, dueFlashcardCount: stats.due, correctAnswerCount: stats.correct, incorrectAnswerCount: stats.incorrect, masteryPercentage: stats.progress },
  };
}

export async function GET(request: Request, context: { params: Promise<{ subjectId: string; topicId?: string }> }) {
  const response = await handlers.GET(request, context);
  if (!response.ok) return response;
  const user = await getCurrentUser();
  if (!user) return response;
  const body = await response.json() as { topics?: Array<{ id: string; flashcardCount: number; metrics?: Record<string, unknown> }>; topic?: { id: string; flashcardCount: number; metrics?: Record<string, unknown> } };
  try {
    const mastery = await getSubjectMastery(user._id);
    if (body.topics) body.topics = body.topics.map((topic) => withMastery(topic, mastery.byTopic.get(topic.id)));
    if (body.topic) body.topic = withMastery(body.topic, mastery.byTopic.get(body.topic.id));
  } catch (error) {
    console.error("Topic mastery metrics could not be loaded.", error);
  }
  return NextResponse.json(body, { status: response.status, headers: response.headers });
}

export const POST = handlers.POST;
