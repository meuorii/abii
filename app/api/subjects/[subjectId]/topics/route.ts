import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { topicHandlers } from "@/lib/topics/http";

export const runtime = "nodejs";
const handlers = topicHandlers({ getCurrentUser, connectToDatabase });
export const GET = handlers.GET;
export const POST = handlers.POST;
