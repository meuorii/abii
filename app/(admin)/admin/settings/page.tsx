import { AdminPageHero } from "@/components/admin/admin-page";
import { AdminSettings } from "@/components/admin/admin-settings";
import { getAdminPageAccess } from "@/lib/auth/admin-page-access";

export default async function Page() {
  if ((await getAdminPageAccess()).status !== 200) return null;
  return <div className="grid min-w-0 gap-5 sm:gap-6"><AdminPageHero page="settings" /><AdminSettings /></div>;
}
