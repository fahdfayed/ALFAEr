import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, Site } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getSessionUser, SITE_COOKIE, type SessionUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/roles";

export {
  PERMISSIONS,
  ROLES,
  ROLE_LABEL,
  ROLE_DESCRIPTION,
  hasPermission,
  type Permission,
} from "@/lib/auth/roles";

export interface Access {
  user: SessionUser;
  site: Site;
  role: Role;
  /** Projects this user can switch to. */
  sites: { id: string; name: string; archived: boolean }[];
  can: (permission: Permission) => boolean;
}

function makeCan(role: Role, isAdmin: boolean) {
  return (permission: Permission) =>
    hasPermission(role, permission) ||
    // A system administrator can always manage a project's settings, so an
    // install cannot end up with a project nobody is able to configure.
    (isAdmin && permission === "manageProject");
}

/**
 * The gate every authenticated page calls. Redirects rather than throwing so
 * an unauthenticated visitor lands on the sign-in page with somewhere to
 * return to.
 */
export async function requireAccess(): Promise<Access> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { site: true },
    orderBy: { site: { name: "asc" } },
  });

  // A system admin can reach every project even without a membership, so a
  // new install is not locked out of the project it just created.
  const sites = user.isAdmin
    ? await prisma.site.findMany({ orderBy: { name: "asc" } })
    : memberships.map((m) => m.site);

  const usable = sites.filter((s) => !s.archived);
  if (sites.length === 0) redirect("/no-projects");

  const jar = await cookies();
  const requested = jar.get(SITE_COOKIE)?.value;
  const site =
    sites.find((s) => s.id === requested) ?? usable[0] ?? sites[0];

  const membership = memberships.find((m) => m.siteId === site.id);
  // An administrator without a membership on this project reads it and can
  // configure it, but does not silently gain the ability to write site
  // records: work is recorded by whoever actually holds a role on the job, so
  // the audit trail names a real person in a real position.
  const role: Role = membership?.role ?? "VIEWER";

  return {
    user,
    site,
    role,
    sites: sites.map((s) => ({ id: s.id, name: s.name, archived: s.archived })),
    can: makeCan(role, user.isAdmin),
  };
}

/** Same, but refuses the page outright when the permission is missing. */
export async function requirePermission(permission: Permission): Promise<Access> {
  const access = await requireAccess();
  if (!access.can(permission)) redirect("/forbidden");
  return access;
}

export async function requireAdmin(): Promise<Access> {
  const access = await requireAccess();
  if (!access.user.isAdmin) redirect("/forbidden");
  return access;
}

export class NotPermittedError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "NotPermittedError";
  }
}

/**
 * The gate every write action calls. Throws instead of redirecting, because a
 * server action returns its error to the form rather than navigating.
 */
export async function requireActionAccess(
  permission: Permission,
): Promise<Access> {
  const user = await getSessionUser();
  if (!user) throw new NotPermittedError("Your session has expired. Sign in again.");

  const access = await requireAccess();
  if (!access.can(permission)) throw new NotPermittedError();
  return access;
}

/** True when the install has no users yet and needs its first administrator. */
export async function needsBootstrap(): Promise<boolean> {
  return (await prisma.user.count()) === 0;
}
