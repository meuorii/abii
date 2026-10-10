export type AuthFieldErrors = Partial<Record<"name" | "email" | "password", string>>;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateRegistration(input: { name: string; email: string; password: string }) {
  const errors: AuthFieldErrors = {};
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (name.length < 1 || name.length > 80) errors.name = "Enter a name between 1 and 80 characters.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (input.password.length < 8 || input.password.length > 128) errors.password = "Use a password between 8 and 128 characters.";
  return { errors, values: { name, email, password: input.password } };
}

export function validateLogin(input: { email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const errors: AuthFieldErrors = {};
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (!input.password || input.password.length > 128) errors.password = "Enter your password.";
  return { errors, values: { email, password: input.password } };
}
