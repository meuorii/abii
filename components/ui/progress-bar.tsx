type ProgressBarProps = {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  className = "",
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 100;
  const percentage = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div className={["space-y-2", className].join(" ")}>
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-3 text-sm">
          {label ? <span className="font-medium text-foreground">{label}</span> : <span />}
          {showValue && <span className="tabular-nums text-muted">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div
        className="h-2.5 overflow-hidden rounded-full bg-pink-card"
        role="progressbar"
        aria-label={label ?? "Progress"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percentage)}
      >
        <div
          className="h-full rounded-full bg-pink-active transition-[width] duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
