import { SkeletonRegion } from "@/components/ui/skeleton";
import { DashboardSkeleton, ProfileSkeleton, ProgressSkeleton, ReviewSkeleton, SettingsSkeleton, SubjectsSkeleton } from "@/components/ui/main-page-skeletons";
import {
  QuizCompletionSkeleton,
  QuizSessionSkeleton,
  ReviewSetupSkeleton,
  SubjectDetailSkeleton,
  SubjectFolderDetailSkeleton,
  TopicDetailSkeleton,
  TopicFolderDetailSkeleton,
} from "@/components/ui/study-page-skeletons";

export type PageLoadingVariant =
  | "dashboard"
  | "subjects"
  | "subject-detail"
  | "folder-detail"
  | "subject-folder-detail"
  | "topic-detail"
  | "review"
  | "quiz-setup"
  | "quiz"
  | "finish"
  | "progress"
  | "settings"
  | "profile";

function Content({ variant, knownQuestionCount = 0 }: { variant: PageLoadingVariant; knownQuestionCount?: number }) {
  switch (variant) {
    case "dashboard": return <DashboardSkeleton />;
    case "subjects": return <SubjectsSkeleton />;
    case "subject-detail": return <SubjectDetailSkeleton />;
    case "folder-detail": return <TopicFolderDetailSkeleton />;
    case "subject-folder-detail": return <SubjectFolderDetailSkeleton />;
    case "topic-detail": return <TopicDetailSkeleton />;
    case "review": return <ReviewSkeleton />;
    case "quiz-setup": return <ReviewSetupSkeleton />;
    case "quiz": return <QuizSessionSkeleton />;
    case "finish": return <QuizCompletionSkeleton knownQuestionCount={knownQuestionCount} />;
    case "progress": return <ProgressSkeleton />;
    case "settings": return <SettingsSkeleton />;
    case "profile": return <ProfileSkeleton />;
  }
}

export function PageLoadingSkeleton({ variant, knownQuestionCount }: { variant: PageLoadingVariant; knownQuestionCount?: number }) {
  const pageLabels: Record<PageLoadingVariant, string> = {
    dashboard: "Loading dashboard page",
    subjects: "Loading subjects page",
    "subject-detail": "Loading subject detail page",
    "folder-detail": "Loading topic folder page",
    "subject-folder-detail": "Loading subject folder page",
    "topic-detail": "Loading topic detail page",
    review: "Loading review page",
    "quiz-setup": "Loading review setup page",
    quiz: "Loading quiz page",
    finish: "Loading quiz completion page",
    progress: "Loading progress page",
    settings: "Loading settings page",
    profile: "Loading profile page",
  };
  const pageSpacing = variant === "folder-detail" || variant === "subject-folder-detail"
    ? "min-w-0 space-y-4 p-4 pb-24 sm:p-5 xl:p-6"
    : variant === "finish"
      ? "w-full px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 lg:px-7 lg:pb-7"
      : variant === "topic-detail"
        ? "min-w-0 space-y-5 p-4 pb-24 sm:p-6 xl:p-7"
        : variant === "dashboard" || variant === "profile" || variant === "subjects" || variant === "review" || variant === "progress" || variant === "settings"
          ? "min-h-full"
          : "space-y-5 p-4 pb-24 sm:p-5 xl:p-6";

  return <SkeletonRegion label={pageLabels[variant]} className="min-h-full">
    <div className={pageSpacing}><Content variant={variant} knownQuestionCount={knownQuestionCount} /></div>
  </SkeletonRegion>;
}
