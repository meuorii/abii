"use client";

import Image from "next/image";
import { ChevronDown, CircleCheck, CircleX } from "lucide-react";

type QuizAnswerFeedbackProps = {
  correct: boolean;
  answer: string | string[];
  answerText: string;
  longAnswer: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
};

export function QuizAnswerFeedback({ correct, answer, answerText, longAnswer, expanded, onToggleExpanded }: QuizAnswerFeedbackProps) {
  const Icon = correct ? CircleCheck : CircleX;
  const mascot = correct ? "/mascot/answer-feedback/correct.png" : "/mascot/answer-feedback/wrong.png";
  const heading = correct ? "Correct!" : "Not quite!";
  const encouragement = correct ? "Great job! You're on the right track!" : "Keep practicing! You'll get it next time.";
  const preview = answerText.length > 140 ? `${answerText.slice(0, 137).trimEnd()}...` : answerText;
  const items = Array.isArray(answer) ? answer : undefined;
  const previewItems = items ? (!expanded ? items.slice(0, answerText.length > 140 ? 1 : 3) : items) : [];

  return (
    <section
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`quiz-answer-feedback quiz-answer-feedback-enter relative mt-4 grid min-h-[138px] min-w-0 grid-cols-[76px_minmax(0,1fr)] items-stretch gap-3 overflow-hidden rounded-[13px] border px-3 py-3 sm:min-h-[176px] sm:grid-cols-[minmax(130px,30%)_minmax(0,1fr)] sm:gap-4 sm:px-5 sm:py-4 ${correct ? "quiz-answer-feedback-correct" : "quiz-answer-feedback-incorrect"}`}
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-[6px] ${correct ? "bg-[#22C77A]" : "bg-[#F05272]"}`} />
      <div aria-hidden="true" className="relative -mb-3 flex min-h-[112px] min-w-0 items-end justify-center sm:-mb-4 sm:min-h-[142px]">
        <Image
          src={mascot}
          alt=""
          width={256}
          height={256}
          sizes="(max-width: 639px) 76px, (max-width: 1023px) 30vw, 210px"
          className="relative h-auto w-[76px] max-w-full shrink-0 object-contain object-bottom sm:w-full sm:max-w-[190px]"
        />
      </div>

      <div className="relative z-10 min-w-0 self-center py-1 pr-0.5 sm:py-0 sm:pr-2">
        <h3 className={`flex min-w-0 items-center gap-2 text-[17px] font-bold leading-tight tracking-[-0.025em] sm:gap-2.5 sm:text-[22px] lg:text-2xl ${correct ? "text-[#20AE68]" : "text-[#D94A67]"}`}>
          <Icon className="h-7 w-7 shrink-0 sm:h-9 sm:w-9" strokeWidth={2.3} aria-hidden="true" />
          <span>{heading}</span>
        </h3>

        <div className="mt-2 min-w-0 break-words text-[12px] leading-[1.45] text-[#2F2930] sm:mt-2.5 sm:text-sm lg:text-[15px]">
          <p className="break-words">
            {correct ? "That's right! The correct answer is " : "Good try! The correct answer is "}
            {items ? null : <strong className="font-bold">&apos;{expanded || !longAnswer ? answer : preview}&apos;</strong>}
            {items ? ":" : "."}
          </p>
          {items && (
            <ul className="my-1.5 list-disc space-y-0.5 pl-5 marker:text-current">
              {previewItems.map((item, i) => <li key={`${i}-${item}`} className="break-words">{!expanded && answerText.length > 140 && item.length > 100 ? `${item.slice(0, 97).trimEnd()}...` : item}</li>)}
              {!expanded && items.length > previewItems.length && <li className="list-none text-xs font-medium">and {items.length - previewItems.length} more</li>}
            </ul>
          )}
          <p className="mt-1">{encouragement}</p>
        </div>

        {longAnswer && (
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
            className={`mt-1.5 inline-flex min-h-8 items-center gap-1 rounded text-xs font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${correct ? "text-[#168A52] focus-visible:ring-[#22C77A]" : "text-[#B83F5A] focus-visible:ring-[#F05272]"}`}
          >
            {expanded ? "Show less" : "Show full answer"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
