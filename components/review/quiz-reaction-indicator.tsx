"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Check, Lightbulb, Sparkles, X } from "lucide-react";
import type { QuizReactionKind } from "@/lib/quiz/reactions";

const styles: Record<QuizReactionKind, { Icon: typeof Sparkles; className: string }> = {
  selection: { Icon: Sparkles, className: "border-[#E8DDE1] bg-[#FFF9FC] text-[#F8769C]" },
  typing: { Icon: Lightbulb, className: "border-[#E8DDE1] bg-[#FFF9FC] text-[#F8769C]" },
  correct: { Icon: Check, className: "border-[#5C947A] bg-[#EDF5EF] text-[#3D7259]" },
  incorrect: { Icon: X, className: "border-[#E8DDE1] bg-[#FCEDEF] text-[#8A1F36]" },
};

export function QuizReactionIndicator({ reaction }: { reaction: { kind: QuizReactionKind; message: string } | null }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false} mode="wait">
      {reaction && (() => {
        const { Icon, className } = styles[reaction.kind];
        return (
          <m.div
            key={`${reaction.kind}:${reaction.message}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 5, scale: 0.96 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: [0.96, 1.015, 1] }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0.01 } } : { opacity: 0, y: -2, scale: 0.985, transition: { duration: 0.18, ease: "easeOut" } }}
            transition={reduceMotion ? { duration: 0.01 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden="true"
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold leading-4 ${className}`}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            <span className="min-w-0 break-words">{reaction.message}</span>
          </m.div>
        );
      })()}
    </AnimatePresence>
  );
}
