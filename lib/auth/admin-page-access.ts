import "server-only";
import { cache } from "react";
import { AdminAccessError, requireAdmin } from "./admin-session";

export const getAdminPageAccess = cache(async () => {
  if (process.env.ABII_ADMIN_UI_ENABLED !== "true") return { status: 404 } as const;
  try {
    const actor = await requireAdmin();
    return { status: 200, name: actor.name } as const;
  } catch (error) {
    return { status: error instanceof AdminAccessError ? error.status : 503 } as const;
  }
});
