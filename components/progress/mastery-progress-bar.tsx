type MasteryProgressBarProps = {
  label: string;
  mastered: number;
  total: number;
  completedRequirements?: number;
  totalRequirements?: number;
  progress: number;
  usable?: number;
  size?: "sm" | "md";
};

export function MasteryProgressBar({ label, mastered, total, completedRequirements = 0, totalRequirements = 0, progress, usable, size = "sm" }: MasteryProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, progress));
  return <div className="min-w-0">
    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
      <span className="font-bold tabular-nums text-[#2F2930]">{percentage}%</span>
    </div>
    <p className="mt-1.5 text-[11px] leading-4 text-[#756B72]">{completedRequirements} of {totalRequirements} mastery requirements completed</p>
    <p className="mt-0.5 text-[11px] leading-4 text-[#756B72]">{mastered} of {total} flashcards fully mastered</p>
    <div className={`${size === "md" ? "h-2.5" : "h-2"} overflow-hidden rounded-full bg-[#F5E9ED]`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={`${percentage}%: ${completedRequirements} of ${totalRequirements} mastery requirements completed; ${mastered} of ${total} flashcards fully mastered`}>
      <div className="h-full rounded-full bg-[#F28BA9] transition-[width] duration-500 ease-out" style={{ width: `${percentage}%` }} />
    </div>
    {usable !== undefined && usable < total && <p className="mt-1.5 text-[11px] leading-4 text-[#8A7E85]">{total - usable} {total - usable === 1 ? "card is" : "cards are"} not eligible for quizzes yet; they are not counted as mastered.</p>}
    {total === 0 && <p className="mt-1.5 text-[11px] leading-4 text-[#8A7E85]">No flashcards yet. Add cards to begin building mastery.</p>}
  </div>;
}
