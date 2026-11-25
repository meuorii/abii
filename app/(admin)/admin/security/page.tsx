import { Suspense } from "react";
import { AdminPageHero } from "@/components/admin/admin-page-hero";
import { AdminSecurity, SecurityControls, SecurityError, SecuritySkeleton } from "@/components/admin/admin-security";
import { parseSecurityQuery, readSecurity, SecurityQueryError, type SecurityQuery } from "@/lib/admin/security";
import { getAdminPageAccess } from "@/lib/auth/admin-page-access";
import { securityCollectionEnabled } from "@/lib/auth/security-evidence";

async function SecurityData({ query }: { query: SecurityQuery }) {
  try {
    return <AdminSecurity report={await readSecurity(query)} collecting={securityCollectionEnabled()} />;
  } catch (error) {
    return <SecurityError message={error instanceof SecurityQueryError ? error.message : "Security evidence could not be loaded."} />;
  }
}

export default async function SecurityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if ((await getAdminPageAccess()).status !== 200) return null;
  const params = await searchParams;
  let query: SecurityQuery;
  try { query = parseSecurityQuery(params); }
  catch (error) {
    return <div className="grid min-w-0 gap-5"><AdminPageHero page="security" /><SecurityError message={error instanceof SecurityQueryError ? error.message : "Invalid security filters."} /></div>;
  }
  return <div className="admin-refined grid min-w-0 gap-5 sm:gap-6">
    <AdminPageHero page="security" />
    <section aria-labelledby="security-overview" className="grid min-w-0 gap-4">
      <SecurityControls query={query} />
      <Suspense key={JSON.stringify(params)} fallback={<SecuritySkeleton />}><SecurityData query={query} /></Suspense>
    </section>
  </div>;
}
