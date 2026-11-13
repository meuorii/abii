import type { CSSProperties, ReactNode } from "react";

type SkeletonBlockProps = {
  className?: string;
  style?: CSSProperties;
};

/** Decorative placeholder. Size and shape stay with the page composition. */
export function SkeletonBlock({ className = "", style }: SkeletonBlockProps) {
  return <div aria-hidden="true" className={`abii-skeleton ${className}`} style={style} />;
}

export function SkeletonCircle({ className = "", style }: SkeletonBlockProps) {
  return <SkeletonBlock className={`rounded-full ${className}`} style={style} />;
}

export function SkeletonCard({ className = "", children }: { className?: string; children?: ReactNode }) {
  return <div aria-hidden="true" className={`rounded-2xl border border-[#F0E5E9] bg-white p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function SkeletonRegion({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}
