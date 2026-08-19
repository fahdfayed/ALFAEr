import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

import { prisma } from "@/lib/db";
import { getSessionUser, SITE_COOKIE } from "@/lib/auth/session";
import { hasPermission, ROLE_LABEL } from "@/lib/auth/roles";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "ALFAEr — Bored Pile Site Records",
  description:
    "Digital pile logs, daily site reports, concrete overbreak tracking and layout progress for bored piling contracts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

const NAV = [
  { href: "/", label: "Today" },
  { href: "/piles", label: "Piles" },
  { href: "/overbreak", label: "Overbreak" },
  { href: "/layout", label: "Layout" },
  { href: "/delays", label: "Lost time" },
  { href: "/productivity", label: "Productivity" },
  { href: "/daily", label: "Reports" },
];

/**
 * Chrome is resolved here rather than through requireAccess, because the
 * layout also wraps the sign-in page and must not redirect into itself.
 */
async function resolveChrome() {
  const user = await getSessionUser();
  if (!user) return null;

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { site: true },
    orderBy: { site: { name: "asc" } },
  });

  const sites = user.isAdmin
    ? await prisma.site.findMany({ orderBy: { name: "asc" } })
    : memberships.map((m) => m.site);
  if (sites.length === 0) return { user, sites: [], site: null, role: null };

  const jar = await cookies();
  const requested = jar.get(SITE_COOKIE)?.value;
  const site =
    sites.find((s) => s.id === requested) ??
    sites.find((s) => !s.archived) ??
    sites[0];

  const role = memberships.find((m) => m.siteId === site.id)?.role ?? null;
  return { user, sites, site, role };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const chrome = await resolveChrome();

  const canManage = chrome?.role
    ? hasPermission(chrome.role, "manageProject")
    : Boolean(chrome?.user.isAdmin);
  const canRecord = chrome?.role ? hasPermission(chrome.role, "recordWork") : false;

  return (
    <html lang="en">
      <body>
        {chrome ? (
          <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
              <Link href="/" className="shrink-0 font-bold tracking-tight">
                ALFA<span className="text-amber-600">Er</span>
              </Link>
              {chrome.site ? (
                <ProjectSwitcher sites={chrome.sites} currentId={chrome.site.id} />
              ) : null}
              <div className="ml-auto flex items-center gap-2">
                <span className="hidden text-xs text-slate-500 sm:inline">
                  {chrome.user.name}
                  {chrome.role ? ` · ${ROLE_LABEL[chrome.role]}` : ""}
                  {chrome.user.isAdmin ? " · Admin" : ""}
                </span>
                <Link
                  href="/account"
                  className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  Account
                </Link>
                <SignOutButton />
              </div>
            </div>

            {chrome.site ? (
              <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 pb-2">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/audit"
                  className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  Audit
                </Link>
                {canManage ? (
                  <Link
                    href="/settings"
                    className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Settings
                  </Link>
                ) : null}
                {chrome.user.isAdmin ? (
                  <Link
                    href="/admin"
                    className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    Admin
                  </Link>
                ) : null}
                {canRecord ? (
                  <Link
                    href="/piles/new"
                    className="btn-primary ml-auto shrink-0 !px-3 !py-1.5"
                  >
                    + Pile log
                  </Link>
                ) : null}
              </div>
            ) : null}
          </header>
        ) : null}
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
