import type { ReactNode } from "react";
import { Card } from "./card";

type FlashcardProps = {
  question: string;
  answer?: string;
  hint?: string;
  subject?: string;
  footer?: ReactNode;
};

export function Flashcard({
  question,
  answer,
  hint,
  subject = "STUDY CARD",
  footer,
}: FlashcardProps) {
  return (
    <Card className="overflow-hidden border-[#F5D9E2] bg-white" padding="none">
      <div className="border-b border-border bg-pink-soft px-5 py-3">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-pink-active">
          {subject}
        </span>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Question</p>
          <p className="text-lg font-bold leading-7 text-foreground">{question}</p>
        </div>
        {hint ? (
          <div className="rounded-xl bg-pink-soft px-4 py-3 text-sm leading-6 text-muted">
            <span className="font-semibold text-pink-active">Hint: </span>{hint}
          </div>
        ) : null}
        {answer ? (
          <div className="rounded-xl border border-[#CDEBD9] bg-success px-4 py-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#286C4A]">Answer</p>
            <p className="text-sm leading-6 text-foreground">{answer}</p>
          </div>
        ) : null}
        {footer ? <div className="border-t border-border pt-4">{footer}</div> : null}
      </div>
    </Card>
  );
}
