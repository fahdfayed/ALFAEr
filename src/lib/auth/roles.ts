import type { Role } from "@prisma/client";

/**
 * Pure role data, importable from client components. Kept separate from
 * access.ts, which is server-only because it reads cookies and the database.
 */

/**
 * What each project role may do. An explicit table rather than inequality
 * checks on an enum, so adding a role later cannot silently grant something
 * through ordering.
 */
export const PERMISSIONS = {
  /** Read any page for the project. */
  view: ["VIEWER", "FOREMAN", "ENGINEER"],
  /** Create and edit pile logs and delays — the day-to-day site record. */
  recordWork: ["FOREMAN", "ENGINEER"],
  /** Change contract settings, thresholds, crew, and import schedules. */
  manageProject: ["ENGINEER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const ROLES: Role[] = ["VIEWER", "FOREMAN", "ENGINEER"];

export const ROLE_LABEL: Record<Role, string> = {
  VIEWER: "Viewer",
  FOREMAN: "Foreman",
  ENGINEER: "Engineer",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  VIEWER: "Read-only. Sees progress and reports, changes nothing.",
  FOREMAN: "Records pile logs and delays. Cannot change contract settings.",
  ENGINEER: "Full control of the project, including settings and imports.",
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
