import "server-only";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { connectToDatabase } from "@/lib/mongodb";
import { AchievementEvent } from "@/models/AchievementEvent";
import { BadgeReconciliation } from "@/models/BadgeReconciliation";
import { ReviewRecord } from "@/models/ReviewRecord";
import { createEarnedBadgeIdempotently, fetchEarnedBadges } from "./repository";
import { BADGE_BY_ID } from "./catalog";
import { calculateAchievementMetrics, createAchievementBaseline, type AchievementBaseline } from "./metrics";
import { evaluateBadgeCatalog, type BadgeEvaluation } from "./evaluator";
import type { BadgeId } from "./types";

export const BADGE_RECONCILIATION_VERSION = 1;
const RECONCILE_FRESH_MS = 6 * 60 * 60 * 1000;
const LOCK_MS = 2 * 60 * 1000;

export type ReconcileResult = { cached: boolean; dryRun: boolean; evaluatedAt: Date; results: BadgeEvaluation[] };

async function hasEvidenceAfter(userId: mongoose.Types.ObjectId, after: Date) {
  const [event, review] = await Promise.all([
    AchievementEvent.exists({ userId, createdAt: { $gt: after } }),
    ReviewRecord.exists({ userId, reviewedAt: { $gt: after } }),
  ]);
  return Boolean(event || review);
}

function cachedResults(record: { results?: unknown[] } | null): BadgeEvaluation[] | null {
  if (!record?.results || record.results.length !== 18) return null;
  return record.results.map((item) => {
    const value = item as BadgeEvaluation & { evidenceSubjectId?: unknown };
    return { ...value, ...(value.evidenceSubjectId ? { evidenceSubjectId: String(value.evidenceSubjectId) } : {}) };
  });
}

function readBaseline(value: unknown): AchievementBaseline | undefined {
  if (!value || typeof value !== "object") return undefined;
  const baseline = value as Record<string, unknown>;
  const ids = (key: string) => Array.isArray(baseline[key]) ? (baseline[key] as unknown[]).map(String) : [];
  const scores = Array.isArray(baseline.qualifyingQuizScores) ? baseline.qualifyingQuizScores as AchievementBaseline["qualifyingQuizScores"] : [];
  const mastery = (baseline.masteryThresholdSubjectIds ?? {}) as Record<string, unknown>;
  return {
    recordedAt: new Date(baseline.recordedAt as Date),
    subjectIds: ids("subjectIds"),
    flashcardCount: Number(baseline.flashcardCount ?? 0),
    flashcardIds: ids("flashcardIds"),
    subjectsWithFlashcards: ids("subjectsWithFlashcards"),
    studyDayKeys: ids("studyDayKeys"),
    completedQuizCount: Number(baseline.completedQuizCount ?? 0),
    completedQuizSessionIds: ids("completedQuizSessionIds"),
    completedQuizDayKeys: ids("completedQuizDayKeys"),
    qualifyingQuizScores: scores.map((score) => ({ ...score, completedAt: new Date(score.completedAt) })),
    correctQuizAnswers: Number(baseline.correctQuizAnswers ?? 0),
    distinctCorrectQuestionIdentities: Number(baseline.distinctCorrectQuestionIdentities ?? 0),
    enumerationFullyCorrectAnswers: Number(baseline.enumerationFullyCorrectAnswers ?? 0),
    resumedQuizCompletions: Number(baseline.resumedQuizCompletions ?? 0),
    resumedQuizSessionIds: ids("resumedQuizSessionIds"),
    masteryThresholdSubjectIds: {
      25: Array.isArray(mastery[25]) ? (mastery[25] as unknown[]).map(String) : [],
      50: Array.isArray(mastery[50]) ? (mastery[50] as unknown[]).map(String) : [],
      75: Array.isArray(mastery[75]) ? (mastery[75] as unknown[]).map(String) : [],
      100: Array.isArray(mastery[100]) ? (mastery[100] as unknown[]).map(String) : [],
    },
  };
}

export async function reconcileUserBadges(userId: string, options: { dryRun?: boolean; force?: boolean; now?: Date } = {}): Promise<ReconcileResult> {
  if (!mongoose.isValidObjectId(userId)) throw new TypeError("A valid authenticated user ID is required.");
  await connectToDatabase();
  const owner = new mongoose.Types.ObjectId(userId);
  const now = options.now ?? new Date();
  const dryRun = Boolean(options.dryRun);
  const previous = await fetchEarnedBadges(userId);
  const alreadyEarned = new Set(previous.map((badge) => badge.badgeId));
  const currentRecord = await BadgeReconciliation.findOne({ userId: owner }).lean();

  if (!dryRun) {
    const current = currentRecord;
    if (!options.force && current?.version === BADGE_RECONCILIATION_VERSION && current.evaluatedAt && now.getTime() - current.evaluatedAt.getTime() < RECONCILE_FRESH_MS && !(await hasEvidenceAfter(owner, current.evaluatedAt))) {
      const saved = cachedResults(current);
      if (saved) return { cached: true, dryRun: false, evaluatedAt: current.evaluatedAt ?? now, results: saved };
    }
  }

  const lockToken = randomUUID();
  let locked = false;
  if (!dryRun) {
    for (let attempt = 0; attempt < 30 && !locked; attempt += 1) {
      try {
        const claimed = await BadgeReconciliation.findOneAndUpdate(
          { userId: owner, $or: [{ lockUntil: { $exists: false } }, { lockUntil: { $lte: new Date() } }] },
          { $set: { lockToken, lockUntil: new Date(Date.now() + LOCK_MS) }, $setOnInsert: { userId: owner } },
          { upsert: true, new: true, runValidators: true },
        ).lean();
        locked = claimed?.lockToken === lockToken;
      } catch (error) {
        if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) throw error;
      }
      if (locked) break;
      const active = await BadgeReconciliation.findOne({ userId: owner }).lean();
      const saved = cachedResults(active);
      const activeLease = Boolean(active?.lockUntil && active.lockUntil > new Date());
      if (saved && active?.version === BADGE_RECONCILIATION_VERSION && !activeLease) return { cached: true, dryRun: false, evaluatedAt: active?.evaluatedAt ?? now, results: saved };
      if (attempt < 29) await delay(100);
    }
    if (!locked) {
      const active = await BadgeReconciliation.findOne({ userId: owner }).lean();
      const saved = cachedResults(active);
      if (saved) return { cached: true, dryRun: false, evaluatedAt: active?.evaluatedAt ?? now, results: saved };
      throw new Error("Badge reconciliation is already running for this user. Please retry shortly.");
    }
  }

  try {
    const baseline = readBaseline(currentRecord?.baseline);
    const metrics = await calculateAchievementMetrics(userId, now, baseline);
    if (!dryRun && !baseline) {
      const initialBaseline = createAchievementBaseline(metrics);
      await BadgeReconciliation.updateOne({ userId: owner, lockToken }, { $set: { baseline: initialBaseline } }, { runValidators: true });
    }
    const results = evaluateBadgeCatalog(metrics, alreadyEarned);
    if (dryRun) return { cached: false, dryRun: true, evaluatedAt: now, results };

    const newAwards = results.filter((result) => result.unlocked && !result.alreadyEarned);
    await Promise.all(newAwards.map((result) => {
      const definition = BADGE_BY_ID[result.badgeId as BadgeId];
      return createEarnedBadgeIdempotently(userId, {
        badgeId: result.badgeId as BadgeId,
        unlockedAt: now,
        verifiedAt: now,
        source: "backfill",
        minimalEvidence: {
          metric: definition.requirement.metric,
          target: definition.requirement.target,
          observed: result.progress,
          ...(result.evidenceSubjectId ? { subjectId: result.evidenceSubjectId } : {}),
          eventId: result.evidenceId ?? `reconciliation-v${BADGE_RECONCILIATION_VERSION}`,
        },
      });
    }));
    const savedResults = results.map((result) => newAwards.some((award) => award.badgeId === result.badgeId) ? { ...result, alreadyEarned: true } : result);
    await BadgeReconciliation.updateOne(
      { userId: owner, lockToken },
      { $set: { version: BADGE_RECONCILIATION_VERSION, evaluatedAt: now, results: savedResults }, $unset: { lockToken: "", lockUntil: "" } },
      { runValidators: true },
    );
    return { cached: false, dryRun: false, evaluatedAt: now, results: savedResults };
  } catch (error) {
    if (!dryRun) await BadgeReconciliation.updateOne({ userId: owner, lockToken }, { $unset: { lockToken: "", lockUntil: "" } });
    throw error;
  }
}
