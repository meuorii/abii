import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

export type AbiiHeroVariant =
  | "dashboard" | "admin" | "admin-overview" | "subjects" | "review"
  | "progress" | "badges" | "settings" | "profile" | "subject-detail"
  | "subject-folder" | "topic-folder" | "topic-detail" | "completion"
  | "review-setup" | "quiz-session";

type AdminHeroStyle = { section: string; layout: string; content: string; mascot: string; mascotAnchor?: string; mascotFrame?: string; imageSizes: string };

const headingSizeByVariant: Record<AbiiHeroVariant, "main" | "admin"> = {
  dashboard: "main", admin: "admin", "admin-overview": "admin", subjects: "main",
  review: "main", progress: "main", badges: "main", settings: "main", profile: "main",
  "subject-detail": "main", "subject-folder": "main", "topic-folder": "main",
  "topic-detail": "main", completion: "main", "review-setup": "main", "quiz-session": "main",
};

const adminStyles: Record<"admin" | "admin-overview", AdminHeroStyle> = {
  admin: {
    section: "sm:border-[#F6DCE5]",
    layout: "sm:min-h-[248px] lg:min-h-[280px] xl:min-h-[310px]",
    content: "sm:max-w-[56%] sm:px-8 sm:py-8 lg:px-9",
    mascot: "sm:w-[40%]",
    mascotAnchor: "sm:right-[3%]",
    mascotFrame: "sm:top-3 sm:bottom-0",
    imageSizes: "(max-width: 639px) 36vw, (max-width: 1023px) 248px, 310px",
  },
  "admin-overview": {
    section: "rounded-[18px] border-border bg-[var(--overview-pink)]",
    layout: "min-h-[164px] sm:min-h-[188px] lg:min-h-[204px]",
    content: "max-w-full px-4 py-5 sm:max-w-[48%] sm:px-7 sm:py-6 min-[1024px]:max-w-[58%]",
    mascot: "w-[34%] sm:w-[32%]",
    mascotAnchor: "right-[2%]",
    mascotFrame: "max-sm:top-0 sm:top-2 bottom-0",
    imageSizes: "(max-width: 639px) 120px, (max-width: 1023px) 220px, 280px",
  },
};

// Alpha bounds are measured from the approved PNGs; crop only their transparent margins.
const mascotFrames: Record<string, { width: number; height: number; alpha: readonly [number, number, number, number]; fit?: "contain" | "cover" }> = {
  "/dashboard-hero/dashboard.png": { width: 1402, height: 1122, alpha: [155, 97, 1187, 1122], fit: "contain" },
  "/dashboard-hero/my-subjects.png": { width: 1122, height: 1268, alpha: [130, 84, 1056, 1268] },
  "/dashboard-hero/review.png": { width: 1122, height: 1402, alpha: [130, 138, 1034, 1402] },
  "/dashboard-hero/progress.png": { width: 1122, height: 1284, alpha: [43, 83, 1061, 1284] },
  "/dashboard-hero/badges.png": { width: 1254, height: 1254, alpha: [101, 128, 1132, 1254] },
  "/dashboard-hero/settings.png": { width: 1122, height: 1241, alpha: [125, 93, 1094, 1241] },
  "/dashboard-hero/profile-hero.png": { width: 1122, height: 1402, alpha: [30, 104, 1089, 1402] },
  "/dashboard-hero/complete.png": { width: 1254, height: 1191, alpha: [79, 105, 1125, 1191] },
};

export function getLearnerHeroMascotFrame(src: string) {
  const frame = mascotFrames[src] ?? { width: 1, height: 1, alpha: [0, 0, 1, 1] as const };
  const [left, top, right, bottom] = frame.alpha;
  const cropWidth = right - left;
  const cropHeight = bottom - top;
  return {
    width: frame.width,
    height: frame.height,
    aspectRatio: `${cropWidth} / ${cropHeight}`,
    fit: frame.fit ?? "cover",
    imageStyle: {
      width: `${frame.width / cropWidth * 100}%`,
      height: `${frame.height / cropHeight * 100}%`,
      left: `${-left / cropWidth * 100}%`,
      top: `${-top / cropHeight * 100}%`,
    } satisfies CSSProperties,
  };
}

export type AbiiPageHeroProps = {
  variant: AbiiHeroVariant;
  headingId?: string;
  eyebrow?: ReactNode;
  /** Optional compact context row rendered between the eyebrow and primary heading. */
  preTitle?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  mascotSrc: string;
  mascotAlt: string;
  priority?: boolean;
  className?: string;
};

export function AbiiPageHero({
  variant, headingId, eyebrow, preTitle, title, description, metadata,
  mascotSrc, mascotAlt, priority = false, className = "",
}: AbiiPageHeroProps) {
  const admin = variant === "admin" || variant === "admin-overview";
  const adminVariant = variant === "admin-overview" ? "admin-overview" : "admin";
  const style = adminStyles[adminVariant];
  const hasPreTitle = variant === "quiz-session" && preTitle != null;
  const frame = getLearnerHeroMascotFrame(mascotSrc);

  return (
    <section
      data-variant={variant}
      data-heading-size={headingSizeByVariant[variant]}
      aria-labelledby={headingId}
      className={`abii-page-hero relative isolate overflow-hidden border border-border bg-secondary-surface font-sans ${admin ? "rounded-[20px]" : "min-h-[180px] rounded-2xl sm:min-h-[240px] sm:rounded-[20px] lg:min-h-[280px]"} ${admin ? style.section : ""} ${className}`}
    >
      <div className={`abii-page-hero__layout relative z-10 w-full ${admin ? `grid min-h-[168px] grid-cols-[minmax(0,1fr)_minmax(78px,34%)] items-stretch gap-x-2 pl-4 pr-3 pt-3.5 pb-0 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(100px,38%)] sm:flex sm:min-h-0 sm:items-center sm:gap-0 sm:px-0 sm:py-0 ${style.layout}` : "grid min-h-[178px] grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch gap-0 sm:min-h-[238px] lg:min-h-[278px]"}`}>
        <div className={`abii-page-hero__content relative z-10 flex min-w-0 flex-col justify-center ${admin ? `gap-2 sm:gap-3 py-3 sm:w-full ${style.content}` : "gap-2 py-4 pl-4 pr-7 sm:gap-3 sm:py-6 sm:pl-6 sm:pr-8 lg:py-8 lg:pl-8 lg:pr-8"}`}>
          {eyebrow != null && <div className="abii-page-hero__eyebrow abii-enter min-w-0 text-xs font-medium leading-[1.35] text-muted sm:text-sm [&>*]:my-0 [&>*]:text-muted">{eyebrow}</div>}
          {preTitle != null && <div className={`abii-page-hero__pre-title ${hasPreTitle ? "abii-enter-1" : "abii-enter-3"} min-w-0 break-words text-sm leading-[1.55] text-foreground`}>{preTitle}</div>}
          <div id={headingId} className={`abii-page-hero__title abii-enter ${hasPreTitle ? "abii-enter-2" : "abii-enter-1"} flex min-w-0 flex-col gap-1.5 break-words sm:block text-foreground [&>*]:my-0 [&_.abii-hero-heading]:text-balance [&_.abii-hero-heading]:text-2xl [&_.abii-hero-heading]:font-bold [&_.abii-hero-heading]:leading-[1.2] [&_.abii-hero-heading]:tracking-[-0.02em] [&_.abii-hero-heading]:text-foreground [&_.abii-hero-emphasis]:text-primary sm:[&_.abii-hero-heading]:text-[2rem] sm:[&_.abii-hero-heading]:leading-[1.15] sm:[&_.abii-hero-heading]:tracking-[-0.025em] lg:[&_.abii-hero-heading]:text-[2.5rem] lg:[&_.abii-hero-heading]:tracking-[-0.03em]`}>{title}</div>
          {description != null && <div className={`abii-page-hero__description abii-enter ${hasPreTitle ? "abii-enter-3" : "abii-enter-2"} min-w-0 break-words text-[13px] font-normal leading-[1.5] text-muted sm:text-sm lg:text-base [&>*]:my-0 [&>*]:text-muted`}>{description}</div>}
          {metadata != null && <div className="abii-page-hero__metadata abii-enter abii-enter-3 min-w-0 break-words text-xs font-medium leading-[1.4] text-muted [&>*]:text-muted">{metadata}</div>}
        </div>
        {admin ? <div className={`abii-page-hero__mascot abii-enter-art pointer-events-none relative col-start-2 row-start-1 flex min-h-0 min-w-0 items-end justify-center max-sm:min-h-[154px] min-[360px]:max-sm:min-h-[158px] sm:absolute ${style.mascotAnchor ?? "sm:right-0"} sm:col-auto sm:row-auto sm:items-end ${style.mascot} ${style.mascotFrame ? "" : "sm:top-0 sm:bottom-0"} ${style.mascotFrame ?? ""}`}>
          <Image src={mascotSrc} alt={mascotAlt} fill priority={priority} sizes={style.imageSizes} className="object-contain object-bottom" />
        </div> : <div className="abii-page-hero__mascot pointer-events-none absolute inset-y-0 left-[60%] right-3 flex items-end justify-end sm:right-6 lg:right-8">
          <div className="abii-page-hero__mascot-motion abii-enter-art relative h-[88%] w-auto max-w-full overflow-hidden sm:h-[90%] sm:max-w-none" style={{ aspectRatio: frame.aspectRatio }}>
            <Image src={mascotSrc} alt={mascotAlt} width={frame.width} height={frame.height} priority={priority} sizes="(max-width: 639px) 40vw, 420px" className={`absolute max-w-none ${frame.fit === "contain" ? "object-contain" : "object-cover"} object-bottom`} style={frame.imageStyle} />
          </div>
        </div>}
      </div>
    </section>
  );
}
