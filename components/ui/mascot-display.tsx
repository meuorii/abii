import { Mascot, type MascotState } from "@/components/ui/mascot";

type MascotDisplayProps = {
  mood?: MascotState | "reminder";
  title?: string;
  message?: string;
  compact?: boolean;
};

const moodCopy: Record<MascotState, { title: string; message: string }> = {
  welcome: { title: "Hi, I’m Abii!", message: "Let’s make learning feel a little lighter." },
  correct: { title: "You got it!", message: "That’s a little win worth celebrating." },
  wrong: { title: "Keep going!", message: "Mistakes help us learn. Try again soon." },
  "review-reminder": { title: "Time for a tiny review?", message: "A quick practice can help it stick." },
  complete: { title: "You did it!", message: "Great work showing up for your learning." },
  empty: { title: "Ready when you are", message: "Your study space is ready for its first card." },
};

export function MascotDisplay({ mood = "welcome", title, message, compact = false }: MascotDisplayProps) {
  const state: MascotState = mood === "reminder" ? "review-reminder" : mood;
  const copy = moodCopy[state];

  return (
    <div className={["flex items-center gap-4", compact ? "text-left" : "flex-col text-center"].join(" ")}>
      <Mascot state={state} size={compact ? "sm" : "md"} />
      <div className={compact ? "min-w-0" : "max-w-xs"}>
        <p className="font-bold text-foreground">{title ?? copy.title}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{message ?? copy.message}</p>
      </div>
    </div>
  );
}
