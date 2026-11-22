import "server-only";
import { AbiiPageHero } from "@/components/ui/abii-page-hero";
import { getAdminPageAccess } from "@/lib/auth/admin-page-access";
import { AdminFeedback, AdminPanel, AdminTable, ChartPanel, MetricCard } from "./admin-ui";

const pages = {
  overview: ["Everything in one view.", "A clearer picture of everything happening across Abii."],
  users: ["Every learner matters.", "Keep accounts organized and the learning space welcoming."],
  analytics: ["See how learning grows.", "Understand the activity and progress behind each study session."],
  performance: ["Keep things running smoothly.", "Stay close to Abii’s speed, stability, and reliability."],
  security: ["A safer place to learn.", "Keep track of access and the actions that protect Abii."],
  announcements: ["Share what’s new.", "Make every update clear, thoughtful, and timely."],
  support: ["Here to help, always.", "Keep conversations organized and support within reach."],
  settings: ["Make every detail count.", "Manage the essentials that keep Abii running your way."],
} as const;

type Page = Exclude<keyof typeof pages, "overview" | "users" | "analytics">;
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
    case "performance":
      return <>
        <div className={split}>
          <ChartPanel title="Response latency" content={unavailable("Latency measurements will appear when monitoring is connected.")} />
          <Pending title="Service status" message="Current service status is unknown. Monitoring is unavailable." />
        </div>
        <PendingTable title="Endpoint monitoring" message="Endpoint measurements are unavailable." />
      </>;
    case "security":
      return <>
        <Summary title="Security at a glance" labels={["Sign-ins", "Denied attempts", "Security events"]} message="Reporting unavailable" />
        <div className={split}>
          <PendingTable title="Audit history" message="Audit records and filters will appear when the history view is connected." />
          <Pending title="Account access" message="Access and session tools are unavailable here." />
        </div>
      </>;
    case "announcements":
      return <>
        <Summary title="Publication summary" labels={["Drafts", "Scheduled", "Published"]} message="Publishing unavailable" />
        <div className={split}>
          <PendingTable title="Announcement list" message="The announcement list is unavailable." />
          <Pending title="Publishing" message="Drafting and scheduling will be available when publishing is connected." />
        </div>
      </>;
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

export function AdminPageHero({ page }: { page: keyof typeof pages }) {
  const [title, description] = pages[page];
  return (
      <AbiiPageHero variant="admin" headingId="admin-page-title" priority
        title={<h1 className="text-[clamp(1.25rem,3.3vw,2.8rem)] leading-[1.08] font-bold tracking-[-0.04em] text-[#203D50]">{title}</h1>}
        description={<p className="mt-3 max-w-[42ch] text-xs leading-5 text-[#6C8192] sm:text-sm sm:leading-6">{description}</p>}
        mascotSrc={`/dashboard-hero/admin/admin-${page}.png`} mascotAlt="" />
  );
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
