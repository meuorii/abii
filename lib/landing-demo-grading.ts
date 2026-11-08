import type { DemoQuestion, DemoQuizMode } from "@/components/landing/demo-data";

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function gradeLandingDemoAnswer(mode: DemoQuizMode, question: DemoQuestion, answers: readonly string[]): boolean {
  if (mode === "enumeration") {
    const submitted = answers.map(normalize);
    const expected = (question.expected ?? []).map(normalize);
    return submitted.length === expected.length && new Set(submitted).size === submitted.length && expected.every((item) => submitted.includes(item));
  }
  if (mode === "multiple-choice") return normalize(answers[0] ?? "") === normalize(question.accepted?.[0] ?? "");
  return question.accepted?.some((expected) => normalize(expected) === normalize(answers[0] ?? "")) ?? false;
}
