export const SESSION_COOKIE = "abii_session";
export const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_ISSUER = "abii";
export const SESSION_AUDIENCE = "abii-web";
export const ADMIN_SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
export const ADMIN_INACTIVITY_TIMEOUT_SECONDS = 30 * 60;
export const ADMIN_FRESH_AUTH_SECONDS = 5 * 60;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};
