import "server-only";
import { getAdminPageAccess } from "@/lib/auth/admin-page-access";
import { AdminFeedback, AdminPanel, AdminTable, MetricCard } from "./admin-ui";
import { AdminPageHero, type AdminPageKey } from "./admin-page-hero";
export { AdminPageHero } from "./admin-page-hero";

type Page = Exclude<AdminPageKey, "overview" | "users" | "analytics" | "performance" | "security" | "announcements">;
const unavailable = (message: string) => ({ kind: "unavailable", message }) as const;
const stack = "grid min-w-0 gap-4";
const split = `${stack} min-[880px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]`;

function Summary({ title, labels, message }: { title: string; labels: string[]; message: string }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {labels.map(label => <MetricCard key={label} label={label} metric={unavailable(message)} />)}
      </div>
    </section>
  );
}

function Pending({ title, description, message }: { title: string; description?: string; message: string }) {
  return <AdminPanel title={title} description={description}><AdminFeedback state={unavailable(message)} /></AdminPanel>;
}

function PendingTable({ title, message }: { title: string; message: string }) {
  return <AdminTable<never> title={title} columns={[]} rowKey={() => ""} content={unavailable(message)} />;
}

function PageContent({ page }: { page: Page }) {
  switch (page) {
    case "support":
      return <>
        <Summary title="Ticket status" labels={["Open", "Awaiting reply", "Resolved"]} message="Ticketing unavailable" />
        <div className={`${stack} min-[880px]:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]`}>
          <PendingTable title="Ticket directory" message="Ticket search and results are unavailable." />
          <Pending title="Conversation" message="Conversations will appear when the ticket directory is connected." />
        </div>
      </>;
    case "settings":
      return <div className={split}>
        <div className={stack}>
          <Pending title="Workspace preferences" description="Administrative workspace defaults" message="Workspace preferences are unavailable." />
          <Pending title="Configuration" description="Platform-wide options" message="Configuration controls are unavailable." />
        </div>
        <Pending title="Account security" description="Administrator credentials and sign-in" message="Account security controls are unavailable in this workspace." />
      </div>;
  }
}

export async function AdminPage({ page }: { page: Page }) {
  if ((await getAdminPageAccess()).status !== 200) return null;
  return (
    <div className="grid min-w-0 gap-5 sm:gap-6">
      <AdminPageHero page={page} />
      <PageContent page={page} />
    </div>
  );
}
