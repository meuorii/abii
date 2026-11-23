import { Suspense } from "react";
import { AdminPageHero } from "@/components/admin/admin-page";
import { AdminAnnouncements, AnnouncementsSkeleton, AnnouncementsUnavailable } from "@/components/admin/admin-announcements";
import { AnnouncementInputError } from "@/lib/admin/announcement-contract";
import { parseAnnouncementQuery, readAnnouncements } from "@/lib/admin/announcements";
import { getAdminPageAccess } from "@/lib/auth/admin-page-access";
import { announcementDeliveryEnabled } from "@/lib/notifications/announcement-worker";

async function AnnouncementData({ params }: { params: Record<string, string | string[] | undefined> }) {
  try {
    const query = parseAnnouncementQuery(params);
    return <AdminAnnouncements query={query} data={await readAnnouncements(query)} enabled={announcementDeliveryEnabled()} />;
  } catch (error) {
    return <AnnouncementsUnavailable message={error instanceof AnnouncementInputError ? error.message : "Announcement storage is unavailable. Reload to try again."} />;
  }
}

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if ((await getAdminPageAccess()).status !== 200) return null;
  const params = await searchParams;
  return <div className="grid min-w-0 gap-5 sm:gap-6">
    <AdminPageHero page="announcements" />
    <Suspense key={JSON.stringify(params)} fallback={<AnnouncementsSkeleton />}><AnnouncementData params={params} /></Suspense>
  </div>;
}
