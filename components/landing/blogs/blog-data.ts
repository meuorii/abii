export type BlogCategory = "Active Recall" | "Study Tips" | "Learning Habits" | "Student Life";

export type BlogArticle = {
  slug: string;
  status: "published" | "draft";
  category: BlogCategory;
  title: string;
  excerpt: string;
  image: string;
  imageAlt: string;
  width: number;
  height: number;
};

export const featuredArticle: BlogArticle = {
  slug: "why-rereading-isnt-enough",
  status: "published",
  category: "Active Recall",
  title: "Why rereading isn't enough to remember what you study.",
  excerpt: "Reading your notes again and again can feel productive, but remembering takes practice. Discover how active recall can help make your study sessions more meaningful.",
  image: "/landing/blogs/featured%20article.jpg",
  imageAlt: "A student writing notes beside an open notebook and study materials",
  width: 2333,
  height: 1866,
};

export const articles: BlogArticle[] = [
  {
    slug: "what-is-active-recall",
    status: "published",
    category: "Active Recall",
    title: "What Is Active Recall, and Why Does It Work?",
    excerpt: "Studying isn't just about reading. It's about remembering. Discover how testing your own knowledge can make every study session more effective.",
    image: "/landing/blogs/article-1.jpg",
    imageAlt: "A student reviewing notes and flashcards at a desk",
    width: 5000,
    height: 4000,
  },
  {
    slug: "small-study-habits",
    status: "published",
    category: "Study Tips",
    title: "5 Small Study Habits That Actually Make a Difference",
    excerpt: "You don't need to change your entire routine to study better. Sometimes, a few small habits are all it takes to make meaningful progress.",
    image: "/landing/blogs/article-2.jpg",
    imageAlt: "A student making notes beside a laptop and textbook",
    width: 4000,
    height: 3200,
  },
  {
    slug: "build-a-study-routine",
    status: "published",
    category: "Learning Habits",
    title: "How to Build a Study Routine You Can Stick To",
    excerpt: "A good study routine should work with your life, not against it. Find simple ways to stay consistent without feeling overwhelmed.",
    image: "/landing/blogs/article-3.jpg",
    imageAlt: "A weekly planner open beside study materials",
    width: 5600,
    height: 4480,
  },
  {
    slug: "flashcards-beyond-memorization",
    status: "published",
    category: "Active Recall",
    title: "Flashcards: More Than Just Memorizing Definitions",
    excerpt: "Flashcards can do more than help you remember words. Explore different ways to challenge your memory and turn simple cards into meaningful practice.",
    image: "/landing/blogs/article-4.jpg",
    imageAlt: "A stack of handwritten flashcards on a wooden table",
    width: 3840,
    height: 3072,
  },
  {
    slug: "organize-your-notes",
    status: "published",
    category: "Study Tips",
    title: "How to Organize Your Notes Without the Overwhelm",
    excerpt: "Scattered notes can make studying harder than it needs to be. Learn how a little organization can bring clarity to your learning space.",
    image: "/landing/blogs/article-5.jpg",
    imageAlt: "Study notes and colorful tabs arranged across a desk",
    width: 2916,
    height: 2333,
  },
  {
    slug: "marilyns-banana-bread",
    status: "published",
    category: "Student Life",
    title: "Marilyn's Banana Bread: A Sweet Little Study Break",
    excerpt: "A cozy food spotlight and a little reminder that study breaks deserve something special, too.",
    image: "/landing/blogs/article-6.jpg",
    imageAlt: "Packaged baked goods arranged on display",
    width: 1536,
    height: 1229,
  },
  {
    slug: "why-study-breaks-matter",
    status: "published",
    category: "Learning Habits",
    title: "Why Taking Breaks Can Help You Learn Better",
    excerpt: "Rest isn't the opposite of productivity. Discover why giving yourself time to recharge can be an important part of learning.",
    image: "/landing/blogs/article-7.jpg",
    imageAlt: "A cup of coffee beside an open book during a study break",
    width: 6245,
    height: 4996,
  },
  {
    slug: "test-yourself-before-an-exam",
    status: "published",
    category: "Active Recall",
    title: "How to Test Yourself Before an Exam",
    excerpt: "Before your next exam, try putting your memory to the test. Learn simple ways to turn your notes into questions and discover what you really know.",
    image: "/landing/blogs/article-8.jpg",
    imageAlt: "A student studying from an open notebook at a desk",
    width: 5000,
    height: 4000,
  },
  {
    slug: "study-plan-before-finals",
    status: "published",
    category: "Study Tips",
    title: "How to Make a Study Plan Before Finals Week",
    excerpt: "Big exams can feel overwhelming, but preparation doesn't have to be. Break your review sessions into smaller, more manageable goals.",
    image: "/landing/blogs/article-9.jpg",
    imageAlt: "A study schedule and exam notes laid out on a desk",
    width: 5840,
    height: 4672,
  },
  {
    slug: "cozy-study-corner-on-a-budget",
    status: "published",
    category: "Student Life",
    title: "Creating a Cozy Study Corner on a Budget",
    excerpt: "Your study space doesn't need to be expensive to feel inspiring. Discover little ways to make your corner more comfortable, organized, and personal.",
    image: "/landing/blogs/article-10.jpg",
    imageAlt: "A warm, compact study corner with books and a desk lamp",
    width: 3024,
    height: 2419,
  },
  {
    slug: "spaced-practice-instead-of-cramming",
    status: "published",
    category: "Learning Habits",
    title: "Stop Cramming: Try Spaced Practice Instead",
    excerpt: "Studying everything in one night isn't always the best approach. Discover how spreading your reviews across time can help you remember more.",
    image: "/landing/blogs/article-11.jpg",
    imageAlt: "A hand marking a study plan in a weekly planner",
    width: 4790,
    height: 3832,
  },
  {
    slug: "start-small-when-studying-feels-overwhelming",
    status: "published",
    category: "Student Life",
    title: "When Studying Feels Overwhelming, Start Small",
    excerpt: "Some days, even opening your notes feels difficult. Learn why small steps, realistic expectations, and a little patience can help you find your rhythm again.",
    image: "/landing/blogs/article-12.jpg",
    imageAlt: "A student writing in a notebook at a table",
    width: 5000,
    height: 4000,
  },
];

export const categories: Array<"All Articles" | BlogCategory> = [
  "All Articles",
  "Study Tips",
  "Active Recall",
  "Learning Habits",
  "Student Life",
];
