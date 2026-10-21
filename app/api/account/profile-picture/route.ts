import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const CLOUDINARY_FOLDER = "media/user/profile";

type CloudinaryUpload = { secure_url?: string; public_id?: string; error?: { message?: string } };
type CloudinaryDestroy = { result?: string; error?: { message?: string } };

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }
  return { cloudName, apiKey, apiSecret };
}

function signature(params: Record<string, string>, apiSecret: string) {
  const canonical = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("&");
  return createHash("sha1").update(`${canonical}${apiSecret}`).digest("hex");
}

async function uploadToCloudinary(bytes: Buffer, mime: string): Promise<{ url: string; publicId: string }> {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedParams = { folder: CLOUDINARY_FOLDER, timestamp };
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(bytes)], { type: mime }), `profile.${mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp"}`);
  form.set("api_key", apiKey);
  form.set("timestamp", timestamp);
  form.set("folder", CLOUDINARY_FOLDER);
  form.set("signature", signature(signedParams, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form, cache: "no-store" });
  const data = await response.json().catch(() => ({})) as CloudinaryUpload;
  if (!response.ok || !data.secure_url || !data.public_id) {
    console.error("Cloudinary profile upload failed:", data.error?.message ?? response.statusText);
    throw new Error("The profile photo could not be uploaded. Please try again.");
  }
  return { url: data.secure_url, publicId: data.public_id };
}

async function deleteFromCloudinary(publicId: string) {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signedParams = { public_id: publicId, timestamp };
  const form = new FormData();
  form.set("public_id", publicId);
  form.set("api_key", apiKey);
  form.set("timestamp", timestamp);
  form.set("signature", signature(signedParams, apiSecret));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: "POST", body: form, cache: "no-store" });
  const data = await response.json().catch(() => ({})) as CloudinaryDestroy;
  if (!response.ok || (data.result !== "ok" && data.result !== "not found")) {
    console.error("Cloudinary profile deletion failed:", data.error?.message ?? response.statusText);
    throw new Error("The hosted profile photo could not be deleted. Please try again.");
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  await connectToDatabase();
  const record = await User.findById(user._id).select("profileImage").lean();
  return NextResponse.json({ profileImage: record?.profileImage ?? "" }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to update your profile photo." }, { status: 401 });

  let body: { image?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Choose a valid image file." }, { status: 400 }); }
  if (typeof body.image !== "string") return NextResponse.json({ error: "Choose a valid image file." }, { status: 400 });
  const match = body.image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || !ALLOWED.has(match[1])) return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 400 });

  let bytes: Buffer;
  try { bytes = Buffer.from(match[2], "base64"); }
  catch { return NextResponse.json({ error: "The image could not be read." }, { status: 400 }); }
  if (!bytes.length || bytes.length > MAX_BYTES) return NextResponse.json({ error: "Profile photos must be 1 MB or smaller." }, { status: 400 });
  const mime = match[1];
  const valid = mime === "image/png"
    ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mime === "image/jpeg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9
      : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (!valid) return NextResponse.json({ error: "The selected file does not appear to be a valid image." }, { status: 400 });

  try {
    await connectToDatabase();
    const uploaded = await uploadToCloudinary(bytes, mime);
    const previous = await User.findById(user._id).select("profileImagePublicId").lean();
    const updated = await User.updateOne(
      { _id: user._id },
      { $set: { profileImage: uploaded.url, profileImagePublicId: uploaded.publicId } },
      { runValidators: true },
    );
    if (!updated.matchedCount) {
      await deleteFromCloudinary(uploaded.publicId).catch(() => {});
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }
    // Guard against silent strict-mode drops: the fields must really have been written.
    if (!updated.modifiedCount) {
      await deleteFromCloudinary(uploaded.publicId).catch(() => {});
      console.error("Profile image was not persisted. Is the User schema missing the profileImage fields? Restart the dev server.");
      return NextResponse.json({ error: "We couldn’t save your profile photo. Please try again." }, { status: 500 });
    }
    // Remove the previous Cloudinary asset after the new URL is safely stored.
    if (previous?.profileImagePublicId && previous.profileImagePublicId !== uploaded.publicId) {
      try { await deleteFromCloudinary(previous.profileImagePublicId); }
      catch (error) { console.error("Old profile image cleanup failed:", error); }
    }
    return NextResponse.json({ message: "Profile photo updated.", profileImage: uploaded.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Profile photo update failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: error instanceof Error && error.message.startsWith("Cloudinary is not configured") ? error.message : "Could not update the profile photo. Check your Cloudinary configuration and try again." }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in to update your profile photo." }, { status: 401 });
  try {
    await connectToDatabase();
    const record = await User.findById(user._id).select("profileImagePublicId").lean();
    if (record?.profileImagePublicId) await deleteFromCloudinary(record.profileImagePublicId);
    await User.updateOne({ _id: user._id }, { $set: { profileImage: null, profileImagePublicId: null } });
    return NextResponse.json({ message: "Profile photo removed." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Profile photo removal failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Could not remove the profile photo. Please try again." }, { status: 500 });
  }
}