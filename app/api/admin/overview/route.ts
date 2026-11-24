import { AdminAccessError, requireAdmin } from "@/lib/auth/admin-session";
import { privateJson } from "@/lib/auth/admin-http";
import { readOverview } from "@/lib/admin/overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.ABII_ADMIN_UI_ENABLED !== "true") return privateJson({ message: "Not found." }, 404);
  try {
    await requireAdmin();
    const period = new URL(request.url).searchParams.get("period");
    if (period !== "7" && period !== "30" && period !== "90") return privateJson({ message: "Choose a 7, 30, or 90 day reporting period." }, 400);
    return privateJson(await readOverview(period));
  } catch (error) {
    if (error instanceof AdminAccessError) return privateJson({ message: error.message }, error.status);
    return privateJson({ message: "Overview reporting is unavailable. Please retry." }, 503);
  }
}
