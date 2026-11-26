import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminPageAccess } from "@/lib/auth/admin-page-access";
import { AdminSignInLink } from "@/components/admin/admin-sign-in-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Abii", robots: { index: false, follow: false } };

const accessMessages = {
      401: ["Sign in to continue", "Sign in with your administrator account to open this workspace.", "/login", "Sign in"],
  403: ["Administrator access required", "This account does not have access to the administration workspace.", "/dashboard", "Return to dashboard"],
  503: ["Sign-in verification unavailable", "Abii could not verify access. Try opening the workspace again.", "/admin", "Try again"],
} as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await getAdminPageAccess();
  if (access.status === 404) notFound();
  if (access.status !== 200) {
    const [title, message, href, action] = accessMessages[access.status];
    return (
      <main className="grid min-h-dvh place-items-center bg-[#FAF9F7] p-4 text-[#30262B]">
        <section className="w-full max-w-md rounded-2xl border border-[#E8DDE1] bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#6F5964]">{message}</p>
          {access.status === 401 ? <AdminSignInLink className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#FFE8EF] px-4 text-sm font-semibold text-[#30262B] hover:bg-[#FFF1F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EC658D]">{action}</AdminSignInLink> : <Link prefetch={false} href={href} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#FFE8EF] px-4 text-sm font-semibold text-[#30262B] hover:bg-[#FFF1F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EC658D]">{action}</Link>}
        </section>
      </main>
    );
  }
  return <AdminShell name={access.name}>{children}</AdminShell>;
}
