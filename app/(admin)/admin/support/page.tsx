import { AdminPageHero } from "@/components/admin/admin-page";
import { AdminSupport } from "@/components/admin/admin-support";
import { parseSupportQuery, readSupportTickets } from "@/lib/admin/support";
import { getAdminPageAccess } from "@/lib/auth/admin-page-access";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if ((await getAdminPageAccess()).status !== 200) return null;
  try { const query = parseSupportQuery(await searchParams); return <div className="grid min-w-0 gap-5 sm:gap-6"><AdminPageHero page="support" /><AdminSupport query={query} data={await readSupportTickets(query)} /></div>; }
  catch { return <div className="grid min-w-0 gap-5 sm:gap-6"><AdminPageHero page="support" /><p role="alert" className="rounded-xl border border-border bg-white p-4 text-sm text-muted">Support storage is unavailable. Reload to try again.</p></div>; }
}
