import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { discardSession } from "@/lib/quiz/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ sessionId: string }> };
export async function DELETE(_request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  try {
    const result = await discardSession(user._id, (await params).sessionId);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
    return NextResponse.json({ discarded: true });
  } catch (error) { console.error("Unable to discard quiz.", error); return NextResponse.json({ error: "This quiz could not be discarded. Please try again." }, { status: 500 }); }
}
