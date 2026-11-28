type MasteryProgressBarProps = {
  progress: number;
  label?: string;
  ariaLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function MasteryProgressBar({
  progress,
  label = "Mastery",
  ariaLabel,
  size = "sm",
  className = "",
}: MasteryProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, Math.round(progress)));
  const barHeight = size === "lg" ? "h-2.5" : size === "md" ? "h-2" : "h-1.5";

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="truncate text-xs font-semibold text-[#6F5964]">{label}</span>
        <span className="shrink-0 text-sm font-bold tabular-nums text-[#30262B]">{percentage}%</span>
      </div>
      <div
        className={`mt-2 ${barHeight} overflow-hidden rounded-full bg-[#E8DDE1]`}
        role="progressbar"
        aria-label={ariaLabel ?? `${label} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-valuetext={`${percentage}%`}
      >
        <div
          className="h-full rounded-full bg-[#EC658D] transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
