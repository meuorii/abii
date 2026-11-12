export const supportCategories = [
  "Account & Login",
  "Subjects & Topics",
  "Flashcards",
  "Reviews & Quizzes",
  "Progress & Badges",
  "Technical Issue",
  "Feedback & Suggestions",
  "Other",
] as const;

export type SupportCategory = (typeof supportCategories)[number];
export type SupportContactErrors = Partial<Record<"name" | "email" | "category" | "message", string>>;

export function validateSupportContact(input: {
  name: unknown;
  email: unknown;
  category: unknown;
  message: unknown;
}) {
  const errors: SupportContactErrors = {};
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const category = typeof input.category === "string" ? input.category : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";

  if (name.length < 1 || name.length > 80) errors.name = "Enter a name between 1 and 80 characters.";
  if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) errors.email = "Enter a valid email address.";
  if (!supportCategories.includes(category as SupportCategory)) errors.category = "Choose a support category.";
  if (message.length < 10 || message.length > 4000) errors.message = "Write a message between 10 and 4,000 characters.";

  return { errors, values: { name, email, category: category as SupportCategory, message } };
}
