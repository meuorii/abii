export const auditLabels = {
  provision: "Administrator provisioned", enroll: "MFA enrolled", "enrollment-restart": "MFA enrollment restarted",
  rotate: "MFA rotated", recover: "Administrator recovery", login: "Administrator MFA succeeded",
  "announcement.create": "Announcement created", "announcement.edit": "Announcement edited",
  "announcement.schedule": "Announcement scheduled", "announcement.reschedule": "Announcement rescheduled",
  "announcement.cancel": "Announcement canceled", "announcement.publish": "Announcement publication committed",
  "announcement.retry": "Announcement delivery retried",
  "support.status": "Support ticket status changed", "support.note": "Support note added", "support.response": "Support response submitted",
  "settings.profile": "Administrator profile updated", "settings.preferences": "Administrator preferences updated",
  "settings.monitoring": "Monitoring alert preferences updated", "settings.platform": "Platform support notice updated",
  "settings.password": "Administrator password changed and sessions revoked",
  logout: "Administrator sessions revoked", "user.suspend": "Learner suspended", "user.restore": "Learner reactivated",
} as const;

export const eventLabels = {
  "login-denied": "Administrator password rejected", "learner-login-denied": "Learner password rejected",
  "learner-login": "Learner signed in", "email-login": "Learner signed in after email verification",
  "mfa-denied": "Administrator MFA rejected", "access-denied": "Administrator access denied",
  "recovery-denied": "Administrator recovery rejected", "learner-recovery-denied": "Learner recovery rejected",
  "password-reset": "Password reset and sessions revoked", "password-change": "Password changed and sessions revoked",
  "rate-limited": "Rate limit applied",
} as const;

export const rateScopes = [
  "login", "login-ip", "admin-mfa-ip", "admin-challenge", "admin-verify", "admin-recover", "admin-enroll",
  "admin-restart", "admin-operator", "recovery", "recovery-ip", "recovery-resend", "recovery-resend-ip",
  "recovery-verify", "recovery-verify-ip", "password-reset", "password-reset-ip", "verify", "verify-ip", "verify-send",
  "register", "register-ip", "otp-send", "admin-user-detail", "admin-user-transition", "admin-password-change",
] as const;

export type AuditKind = keyof typeof auditLabels;
export type EventKind = keyof typeof eventLabels;
export type Scope = typeof rateScopes[number];
export type Period = "24h" | "7d" | "30d";
export type Source = "audit" | "event";
export type Actor = "admin" | "learner" | "unknown";
export type Outcome = "success" | "failure" | "denied" | "rate-limited" | "committed";
export const securityTimelineIndex = "security_timeline";
export const securityCorrelationIndex = "security_correlation";
export const auditRetentionDays = 365;
export const eventRetentionDays = 90;
export const dayMs = 86_400_000;
export const securityPeriods = { "24h": 1, "7d": 7, "30d": 30 } as const;

export function isScope(value: unknown): value is Scope {
  return typeof value === "string" && (rateScopes as readonly string[]).includes(value);
}
export function isAccountId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{24}$/i.test(value);
}
export function isCorrelationId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type SecurityRow = {
  id: string;
  source: Source;
  label: string;
  kind: AuditKind | EventKind;
  at: number;
  lastAt: number;
  actor: Actor;
  actorId: string | null;
  target: { kind: "Administrator" | "Learner" | "Announcement"; id: string } | null;
  outcome: Outcome;
  correlation: string | null;
  count: number | null;
  scope: Scope | null;
  coverage: "committed" | "observed" | "representative";
};
