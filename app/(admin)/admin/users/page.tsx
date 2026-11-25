import { redirect } from "next/navigation";
import { AdminPageHero } from "@/components/admin/admin-page";
import { AccountOverview, LearnerDirectory } from "@/components/admin/admin-users";
import { getAdminPageAccess } from "@/lib/auth/admin-page-access";
import { parseUsersQuery, readAccountCounts, readUsersPage, UsersQueryError, UsersSearchUnavailable } from "@/lib/admin/users";
import { type UsersPage, usersHref } from "@/lib/admin/users-contract";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if ((await getAdminPageAccess()).status !== 200) return null;
  const params = await searchParams;
  let parsed = parseUsersQuery({});
  let inputError: string | null = null;
  try { parsed = parseUsersQuery(params); }
  catch (error) {
    if (!(error instanceof UsersQueryError)) throw error;
    inputError = error.message;
  }
  const { query, cursor } = parsed;
  const [counts, directory] = await Promise.allSettled([
    readAccountCounts(), inputError ? Promise.resolve(null) : readUsersPage(query, cursor),
  ]);
  let page: UsersPage | null = null;
  let error = inputError;
  if (directory.status === "fulfilled") page = directory.value;
  else if (directory.reason instanceof UsersQueryError || directory.reason instanceof UsersSearchUnavailable) error = directory.reason.message;
  else error = "The learner directory is temporarily unavailable.";
  if (cursor && page?.rows.length === 0) redirect(usersHref(query));

  return (
    <div className="admin-overview-workspace admin-refined grid min-w-0 gap-5 bg-[#FFF9FC] sm:gap-6">
      <AdminPageHero page="users" />
      <AccountOverview counts={counts.status === "fulfilled" ? counts.value : null} />
      <LearnerDirectory query={query} cursor={cursor} page={page} error={error} />
    </div>
  );
}
