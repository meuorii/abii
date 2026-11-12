import {
  Brain,
  ChartNoAxesColumnIncreasing,
  FolderOpen,
  Layers,
  Rocket,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type HelpGuide = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  note?: string;
  href?: string;
};

export type HelpCategory = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  guides: HelpGuide[];
};

export const helpCategories: HelpCategory[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Set up your account and begin with one subject.",
    icon: Rocket,
    guides: [
      { id: "create-account", title: "Create your Abii account", summary: "Make an account to keep your study materials and progress together.", steps: ["Choose Get Started and enter your name, email, and password.", "Open the verification email Abii sends to your inbox.", "Enter the verification code to finish setting up your account."], href: "/register" },
      { id: "verify-email", title: "Verify your email address", summary: "Email verification helps you securely access your account.", steps: ["Check the inbox for the email address you used to register.", "Look in spam or promotions if it is not in your main inbox.", "Return to Abii and enter the latest verification code. Use the resend option if the code has expired."], href: "/verify-email" },
      { id: "first-subject", title: "Create your first subject", summary: "Subjects give your learning a clear home.", steps: ["Open Subjects from your study workspace.", "Choose the option to add a subject and give it a name.", "Open the subject to add topics and flashcards."], href: "/subjects" },
    ],
  },
  {
    id: "subjects-topics",
    title: "Subjects & Topics",
    description: "Keep classes, lessons, and study materials in order.",
    icon: FolderOpen,
    guides: [
      { id: "organize-subjects", title: "Create and manage subjects", summary: "Use a subject for each class or area you are learning.", steps: ["Open Subjects in your workspace.", "Add a subject, then open it to manage its topics and folders.", "Use the subject view to return to its learning materials."], href: "/subjects" },
      { id: "topic-folders", title: "Organize topics into folders", summary: "Group related topics into units, lessons, or exam coverage.", steps: ["Open the subject that contains the topics.", "Create a topic folder and give it a clear name.", "Move or add related topics to the folder so they stay together."], href: "/subjects" },
      { id: "edit-materials", title: "Edit or remove learning materials", summary: "Keep subject and topic names up to date as your course changes.", steps: ["Open the subject, topic, or folder you want to change.", "Use its available actions to edit the name or details.", "Review the confirmation before deleting an item."], href: "/subjects" },
    ],
  },
  {
    id: "flashcards",
    title: "Flashcards",
    description: "Turn notes into focused active-recall practice.",
    icon: Layers,
    guides: [
      { id: "standard-flashcard", title: "Create a standard flashcard", summary: "Write a prompt on one side and the answer you want to recall on the other.", steps: ["Open a topic and choose to add a flashcard.", "Enter a focused question and its answer.", "Save the card, then include it in a review when you are ready."], href: "/subjects" },
      { id: "enumeration-flashcard", title: "Create an enumeration flashcard", summary: "Use an enumeration card when the answer is a list of items.", steps: ["Choose the enumeration flashcard format.", "Enter the question and each expected item in the answer.", "Review the list by recalling its items, not just recognizing the topic."], href: "/subjects" },
      { id: "edit-flashcards", title: "Edit and organize flashcards", summary: "Keep cards with the topic where you plan to review them.", steps: ["Open the topic that contains the card.", "Choose the card's edit action to update its prompt or answer.", "Save your changes and return to the topic's flashcard list."], href: "/subjects" },
    ],
  },
  {
    id: "reviews-quizzes",
    title: "Reviews & Quizzes",
    description: "Choose a review format and practice retrieving what you know.",
    icon: Brain,
    guides: [
      { id: "start-review", title: "Start a review", summary: "Choose the material you want to practice and begin a session.", steps: ["Open Reviews and choose Start Review.", "Select the subjects or topics to include.", "Choose an available review mode and begin."], href: "/review/setup" },
      { id: "choose-review-mode", title: "Choose a review mode", summary: "Match the question style to the kind of practice you need.", steps: ["Multiple Choice lets you select an answer.", "Identification asks you to recall and enter an answer; True or False asks you to judge a statement.", "Mixed / Random combines eligible question types. Enumeration cards can be reviewed in list-based formats."], href: "/review/setup" },
      { id: "resume-review", title: "Continue an unfinished review", summary: "Return to an active review session without starting over.", steps: ["Open Reviews while signed in.", "If an unfinished session is available, choose its continue or resume action.", "Continue answering, or finish the session to see its results."], href: "/review" },
    ],
  },
  {
    id: "progress-badges",
    title: "Progress & Badges",
    description: "See study activity, mastery, and milestones as they grow.",
    icon: ChartNoAxesColumnIncreasing,
    guides: [
      { id: "understand-mastery", title: "Understand subject mastery", summary: "Progress views summarize how your reviewed material is going.", steps: ["Open Progress or a subject's progress view.", "Review the mastery indicators alongside the underlying study activity.", "Use lower or incomplete areas to choose what to practice next."], href: "/progress" },
      { id: "find-study-activity", title: "Find your study activity", summary: "Use progress views to review your learning activity over time.", steps: ["Open Progress from your workspace.", "Review the activity and subject summaries available on the page.", "Return to a subject or topic when you want to practice a specific area."], href: "/progress" },
      { id: "badges-achievements", title: "Understand badges and achievements", summary: "Badges recognize milestones reached through your study activity.", steps: ["Open the Badges page from your workspace.", "Choose a badge to read what it recognizes.", "Keep studying naturally; badges update when their requirements are met."], href: "/badges" },
    ],
  },
  {
    id: "account-security",
    title: "Account & Security",
    description: "Manage your sign-in details and keep your account secure.",
    icon: ShieldCheck,
    guides: [
      { id: "password-reset", title: "Reset your password", summary: "Request a password reset code if you cannot sign in.", steps: ["Open Forgot Password from the sign-in page.", "Enter the email address on your account and request a code.", "Use the code to choose a new password."], href: "/forgot-password" },
      { id: "update-account", title: "Update account information", summary: "Manage profile details from your account settings.", steps: ["Sign in and open Settings.", "Choose the account or profile detail you want to update.", "Save the change and review the updated information."], href: "/settings" },
      { id: "verification-troubleshooting", title: "Troubleshoot verification email", summary: "A few checks can help you find a missing verification message.", steps: ["Confirm that the email address is typed correctly.", "Check spam, promotions, and any inbox filters.", "Return to the verification flow and request a fresh code. Use the newest email."], href: "/verify-email" },
    ],
  },
];

export type SupportFaq = { id: string; question: string; answer: string; guideId?: string };

export const supportFaqs: SupportFaq[] = [
  { id: "what-is-abii", question: "What is Abii?", answer: "Abii is an active-recall study app. Organize subjects and topics, make flashcards, practice retrieving information, and review your learning progress.", guideId: "create-account" },
  { id: "getting-started", question: "How do I get started with Abii?", answer: "Create an account, verify your email, then add a subject and your first topic or flashcard.", guideId: "first-subject" },
  { id: "folders", question: "Can I organize subjects and topics into folders?", answer: "Yes. Abii supports subject and topic folders so related learning materials can stay together.", guideId: "topic-folders" },
  { id: "flashcard-types", question: "What types of flashcards can I create?", answer: "You can create standard question-and-answer cards and enumeration cards for list-based answers.", guideId: "enumeration-flashcard" },
  { id: "review-modes", question: "What review modes are available?", answer: "Abii supports Multiple Choice, Identification, True or False, and Mixed / Random review. Enumeration cards can use their corresponding list-based question formats.", guideId: "choose-review-mode" },
  { id: "progress", question: "How does Abii track my progress?", answer: "Progress views summarize mastery and study activity based on your learning and review history. Use them to decide what to practice next.", guideId: "understand-mastery" },
  { id: "resume", question: "Can I resume an unfinished review?", answer: "Yes. When an unfinished review session is available, return to Reviews and choose the continue or resume action.", guideId: "resume-review" },
  { id: "missing-verification", question: "What if I don't receive my verification email?", answer: "Check that you entered the right address, look in spam or promotions, and request a fresh code from the verification flow. Use the newest code you receive.", guideId: "verification-troubleshooting" },
];

export const popularGuideIds = ["first-subject", "standard-flashcard", "start-review", "password-reset"];

export function findGuide(guideId: string) {
  for (const category of helpCategories) {
    const guide = category.guides.find(item => item.id === guideId);
    if (guide) return { category, guide };
  }
  return null;
}
