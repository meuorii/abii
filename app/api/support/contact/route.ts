import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { limited, rateAllowed, rateAllowedByTrustedIp, validOrigin } from "@/lib/auth/http";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import { renderSupportEmail } from "@/lib/email/support-template";
import { validateSupportContact } from "@/lib/support/validation";
import { SupportSubmission } from "@/models/SupportSubmission";

export const runtime = "nodejs";

const maxBodyBytes = 20 * 1024;
const processingExpiry = 10 * 60_000;
const acceptedExpiry = 24 * 60 * 60_000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty-body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBodyBytes) {
      await reader.cancel();
      throw new RangeError("body-too-large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function safeFailure(status = 503) {
  return NextResponse.json({ message: "We couldn't send your message right now. Please try again." }, { status });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !validOrigin(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  if (request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ message: "Please submit the contact form using JSON." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) return NextResponse.json({ message: "Your message is too large." }, { status: 413 });

  let body: unknown;
  try {
    body = await readJson(request);
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ message: "Your message is too large." }, { status: 413 });
    return NextResponse.json({ message: "Please check the form and try again." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ message: "Please check the form and try again." }, { status: 400 });
  const data = body as Record<string, unknown>;
  if (typeof data.website === "string" && data.website.trim()) return NextResponse.json({ message: "Please check the form and try again." }, { status: 400 });

  const { errors, values } = validateSupportContact({ name: data.name, email: data.email, category: data.category, message: data.message });
  if (Object.keys(errors).length) return NextResponse.json({ message: "Please check the highlighted fields.", errors }, { status: 400 });

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return NextResponse.json({ message: "Please refresh the form and try again." }, { status: 400 });
  }

  try {
    if (!(await rateAllowed("support-contact-email", values.email, 3, 60 * 60_000))) return limited();
    if (!(await rateAllowedByTrustedIp(request, "support-contact-ip", 10, 60 * 60_000))) return limited();
    if (!(await rateAllowed("support-contact-global", "public", 100, 60 * 60_000))) return limited();

    const secret = process.env.AUTH_OTP_SECRET;
    if (!secret || secret.length < 32) return safeFailure();
    const key = createHmac("sha256", secret).update(idempotencyKey).digest("hex");
    await connectToDatabase();

    let reserved = false;
    try {
      await SupportSubmission.create({ key, status: "processing", expiresAt: new Date(Date.now() + processingExpiry) });
      reserved = true;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
      const previous = await SupportSubmission.findOne({ key }).lean() as { status?: string; expiresAt?: Date } | null;
      if (previous?.status === "accepted") return NextResponse.json({ message: "Your message was already submitted." });
      if (previous?.status === "failed" || (previous?.status === "processing" && previous.expiresAt && previous.expiresAt.getTime() <= Date.now())) {
        const reclaimFilter = previous.status === "failed"
          ? { key, status: "failed" }
          : { key, status: "processing", expiresAt: { $lte: new Date() } };
        const reclaimed = await SupportSubmission.findOneAndUpdate(
          reclaimFilter,
          { $set: { status: "processing", expiresAt: new Date(Date.now() + processingExpiry) } },
          { new: true },
        ).lean();
        reserved = Boolean(reclaimed);
      }
      if (!reserved) return NextResponse.json({ message: "This message is already being processed. Please wait before retrying." }, { status: 409 });
    }

    const recipient = process.env.SUPPORT_INBOX_EMAIL?.trim().toLowerCase();
    if (!recipient || recipient.length > 254 || !emailPattern.test(recipient)) {
      await SupportSubmission.updateOne({ key }, { $set: { status: "failed", expiresAt: new Date(Date.now() + processingExpiry) } });
      return safeFailure();
    }

    let result: Awaited<ReturnType<typeof sendTransactionalEmail>>;
    try {
      const content = renderSupportEmail({ ...values, submittedAt: new Date() });
      result = await sendTransactionalEmail({
        recipient,
        ...content,
        replyTo: { email: values.email, name: values.name },
      });
    } catch {
      // Configuration/template errors occur before a provider response, so a retry is safe.
      await SupportSubmission.updateOne({ key }, { $set: { status: "failed", expiresAt: new Date(Date.now() + processingExpiry) } });
      return safeFailure();
    }
    if (!result.ok) {
      if (result.status === 0 || result.status >= 500) {
        // Keep the idempotency reservation after an ambiguous provider result.
        return safeFailure();
      }
      await SupportSubmission.updateOne({ key }, { $set: { status: "failed", expiresAt: new Date(Date.now() + processingExpiry) } });
      return safeFailure(result.status === 429 ? 503 : 502);
    }

    await SupportSubmission.updateOne({ key }, { $set: { status: "accepted", expiresAt: new Date(Date.now() + acceptedExpiry) } });
    return NextResponse.json({ message: "Message submitted to Abii support." }, { status: 202 });
  } catch {
    return safeFailure();
  }
}
