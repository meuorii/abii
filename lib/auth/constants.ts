export const SESSION_COOKIE = "abii_session";
export const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_ISSUER = "abii";
export const SESSION_AUDIENCE = "abii-web";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};
