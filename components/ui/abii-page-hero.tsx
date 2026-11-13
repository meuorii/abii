import Image from "next/image";
import type { ReactNode } from "react";

export type AbiiHeroVariant =
  | "dashboard"
  | "subjects"
  | "review"
  | "progress"
  | "badges"
  | "settings"
  | "profile"
  | "subject-detail"
  | "subject-folder"
  | "topic-folder"
  | "topic-detail"
  | "completion"
  | "review-setup"
  | "quiz-session";

type VariantStyle = {
  section: string;
  layout: string;
  content: string;
  mascot: string;
  mascotAnchor?: string;
  mascotFrame?: string;
  imagePosition?: string;
  imageSizes: string;
};

const variants: Record<AbiiHeroVariant, VariantStyle> = {
  dashboard: {
    section: "sm:rounded-[20px] sm:border-[#F6DCE5] sm:bg-[#FFF0F5]",
    layout: "sm:min-h-[248px] lg:min-h-[254px]",
    content: "sm:max-w-[57%] sm:px-8 sm:py-8 lg:max-w-[56%] lg:px-9",
    mascot: "sm:w-[49%] lg:w-[48%]",
    imagePosition: "object-[right_bottom]",
    imageSizes: "(max-width: 639px) 31vw, (max-width: 1023px) 42vw, 520px",
  },
  subjects: {
    section: "sm:rounded-[1.15rem] sm:border-[#F7DFE7] sm:bg-[#FFF0F5]",
    layout: "sm:min-h-[238px] lg:min-h-[242px]",
    content: "sm:max-w-[52%] sm:px-8 sm:py-8 lg:max-w-[51%] lg:px-9",
    mascot: "sm:w-[43%] lg:w-[42%]",
    imagePosition: "object-[right_bottom]",
    imageSizes: "(max-width: 639px) 31vw, (max-width: 1023px) 45vw, 460px",
  },
  review: {
    section: "sm:rounded-[1.4rem] sm:border-[#F5DDE5] sm:bg-[#FFF1F5]",
    layout: "sm:min-h-[245px] lg:min-h-[265px]",
    content: "sm:max-w-[53%] sm:px-7 sm:py-8 lg:max-w-[52%] lg:px-8",
    mascot: "sm:w-[42%] lg:w-[40%]",
    imageSizes: "(max-width: 639px) 31vw, (max-width: 1023px) 45vw, 440px",
  },
  progress: {
    section: "sm:rounded-2xl sm:border-[#F8E6EC] sm:bg-[#FFF0F4]",
    layout: "sm:min-h-[230px] sm:px-8 sm:py-8 xl:min-h-[250px] xl:px-10",
    content: "sm:max-w-[57%]",
    mascot: "sm:w-[37%] xl:w-[35%]",
    imageSizes: "(max-width: 639px) 31vw, 440px",
  },
  badges: {
    section: "sm:rounded-2xl sm:border-[#F8E6EC] sm:bg-[#FFF0F4]",
    layout: "sm:min-h-[230px] sm:px-8 sm:py-8 xl:min-h-[250px] xl:px-10",
    content: "sm:max-w-[57%]",
    mascot: "sm:w-[37%] xl:w-[35%]",
    imageSizes: "(max-width: 639px) 31vw, 440px",
  },
  settings: {
    section: "sm:rounded-2xl sm:border-[#F8E4EB] sm:bg-[#FFF0F4]",
    layout: "sm:min-h-[230px] sm:px-7 sm:py-5 lg:min-h-[248px] lg:px-8",
    content: "sm:max-w-[55%] lg:max-w-[56%]",
    mascot: "sm:w-[37%] lg:w-[35%]",
    imagePosition: "object-right-bottom",
    imageSizes: "(max-width: 639px) 31vw, (max-width: 1023px) 40vw, 390px",
  },
  profile: {
    section: "sm:rounded-2xl sm:border-[#F6DCE5] sm:bg-[#FFF0F5]",
    layout: "sm:min-h-[230px] lg:min-h-[250px]",
    content: "sm:max-w-[59%] sm:px-8 sm:py-7 lg:max-w-[58%] lg:px-9",
    mascot: "sm:w-[40%] lg:w-[38%]",
    mascotAnchor: "sm:right-2 lg:right-4",
    imageSizes: "(max-width: 639px) 31vw, (max-width: 1023px) 38vw, 240px",
  },
  "subject-detail": {
    section: "sm:rounded-[1.35rem] sm:border-[#F5DDE5] sm:bg-[#FFF1F5]",
    layout: "sm:min-h-[285px] lg:min-h-[300px]",
    content: "sm:max-w-[57%] sm:px-7 sm:py-7 lg:max-w-[56%] lg:px-8",
    mascot: "sm:w-[36%] lg:w-[35%]",
    imageSizes: "(max-width: 639px) 31vw, 420px",
  },
  "subject-folder": {
    section: "sm:rounded-[1.35rem] sm:border-[#F5DDE5] sm:bg-[#FFF1F5]",
    layout: "sm:min-h-[280px]",
    content: "sm:max-w-[58%] sm:px-8",
    mascot: "sm:w-[37%]",
    imageSizes: "(max-width: 639px) 31vw, 420px",
  },
  "topic-folder": {
    section: "sm:rounded-[1.35rem] sm:border-[#F5DDE5] sm:bg-[#FFF1F5]",
    layout: "sm:min-h-[285px] lg:min-h-[300px]",
    content: "sm:max-w-[58%] sm:px-7 lg:px-8",
    mascot: "sm:w-[37%]",
    imageSizes: "(max-width: 639px) 31vw, 420px",
  },
  "topic-detail": {
    section: "sm:rounded-[1.35rem] sm:border-[#F5DDE5] sm:bg-[#FFF1F5]",
    layout: "sm:min-h-[285px] lg:min-h-[300px]",
    content: "sm:max-w-[57%] sm:px-7 sm:py-8 lg:max-w-[56%] lg:px-8",
    mascot: "sm:w-[36%] lg:w-[35%]",
    imageSizes: "(max-width: 639px) 31vw, 420px",
  },
  completion: {
    section: "bg-[linear-gradient(112deg,#FFF7F9_0%,#FFE8EF_58%,#FFDCE9_100%)] sm:rounded-[24px] sm:border-[#F8E5EC] sm:min-h-[250px] lg:min-h-[280px]",
    layout: "sm:min-h-[250px] sm:px-8 sm:py-8 lg:min-h-[280px] lg:px-10",
    content: "sm:max-w-[55%] lg:max-w-[54%]",
    mascot: "sm:w-[38%] lg:w-[35%]",
    mascotAnchor: "sm:right-5 lg:right-10",
    mascotFrame: "sm:top-auto sm:bottom-[-0.5rem] sm:h-[85%]",
    imageSizes: "(max-width: 639px) 31vw, (max-width: 1023px) 36vw, 420px",
  },
  "review-setup": {
    section: "sm:rounded-[1.4rem] sm:border-[#F5DDE5] sm:bg-[#FFF1F5]",
    layout: "sm:min-h-[210px]",
    content: "sm:max-w-[55%] sm:px-8 sm:py-8",
    mascot: "sm:w-[38%]",
    imageSizes: "(max-width: 639px) 31vw, 380px",
  },
  "quiz-session": {
    section: "sm:rounded-[1.4rem] sm:border-[#F5DDE5] sm:bg-[#FFF1F5]",
    layout: "sm:min-h-[210px]",
    content: "sm:max-w-[59%] sm:px-7 sm:py-6",
    mascot: "sm:w-[38%] lg:w-[37%]",
    imageSizes: "(max-width: 639px) 31vw, (max-width: 1023px) 38vw, 320px",
  },
};

export type AbiiPageHeroProps = {
  variant: AbiiHeroVariant;
  headingId?: string;
  eyebrow?: ReactNode;
  /** Optional compact context row rendered between the eyebrow and primary heading. */
  preTitle?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  mascotSrc: string;
  mascotAlt: string;
  priority?: boolean;
  className?: string;
  decoration?: ReactNode;
};

export function AbiiPageHero({
  variant,
  headingId,
  eyebrow,
  preTitle,
  title,
  description,
  metadata,
  actions,
  mascotSrc,
  mascotAlt,
  priority = false,
  className = "",
  decoration,
}: AbiiPageHeroProps) {
  const style = variants[variant];
  const hasPreTitle = variant === "quiz-session" && preTitle != null;

  return (
    <section
      aria-labelledby={headingId}
      className={`abii-page-hero relative isolate overflow-hidden rounded-[20px] border border-[#F5DDE5] bg-[#FFF0F5] ${style.section} ${className}`}
    >
      {decoration}
      <div className={`abii-page-hero__layout relative z-10 grid min-h-[168px] grid-cols-[minmax(0,1fr)_minmax(78px,34%)] items-stretch gap-x-2 pl-4 pr-3 pt-3.5 pb-0 min-[360px]:grid-cols-[minmax(0,1fr)_minmax(100px,38%)] sm:flex sm:min-h-0 sm:items-center sm:gap-0 sm:px-0 sm:py-0 ${style.layout}`}>
        <div className={`abii-page-hero__content relative z-10 flex min-w-0 flex-col justify-center py-3 sm:w-full ${style.content}`}>
          {eyebrow != null && <div className="abii-page-hero__eyebrow abii-enter min-w-0">{eyebrow}</div>}
          {preTitle != null && <div className={`abii-page-hero__pre-title ${hasPreTitle ? "abii-enter-1" : "abii-enter-3"} min-w-0 break-words`}>{preTitle}</div>}
          <div id={headingId} className={`abii-page-hero__title abii-enter ${hasPreTitle ? "abii-enter-2" : "abii-enter-1"} min-w-0 break-words`}>{title}</div>
          {description != null && <div className={`abii-page-hero__description abii-enter ${hasPreTitle ? "abii-enter-3" : "abii-enter-2"} min-w-0 break-words`}>{description}</div>}
          {metadata != null && <div className="abii-page-hero__metadata abii-enter abii-enter-3 min-w-0 break-words">{metadata}</div>}
          {actions != null && <div className="abii-page-hero__actions abii-enter abii-enter-4 min-w-0">{actions}</div>}
        </div>
        <div className={`abii-page-hero__mascot abii-enter-art pointer-events-none relative col-start-2 row-start-1 flex min-h-[154px] min-w-0 items-end justify-center min-[360px]:min-h-[158px] sm:absolute ${style.mascotAnchor ?? "sm:right-0"} sm:col-auto sm:row-auto sm:min-h-0 sm:items-end ${style.mascotFrame ? "" : "sm:top-0 sm:bottom-0"} ${style.mascot} ${style.mascotFrame ?? ""}`}>
          <Image
            src={mascotSrc}
            alt={mascotAlt}
            fill
            priority={priority}
            sizes={style.imageSizes}
            className={`object-contain object-bottom ${style.imagePosition ?? ""}`}
          />
        </div>
      </div>
    </section>
  );
}
