import Link from "next/link";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/access";
import { ROLE_LABEL } from "@/lib/auth/roles";
import {
  CreateUserForm,
  MembershipForm,
  ResetPasswordForm,
  ToggleUserButton,
} from "@/components/AdminForms";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();

  const [users, sites] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { memberships: { include: { site: true } } },
    }),
    prisma.site.findMany({ orderBy: { name: "asc" } }),
  ]);

  const activeAdmins = users.filter((u) => u.isAdmin && u.active).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">People</h1>
          <p className="mt-1 text-sm text-slate-500">
            Who can sign in, and what they can do on each project.
          </p>
        </div>
        <Link href="/admin/projects" className="btn-secondary">
          Projects
        </Link>
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Email</th>
                <th className="px-4 py-2 font-semibold">Projects</th>
                <th className="px-4 py-2 font-semibold">Last signed in</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">
                    {u.name}
                    {u.isAdmin ? (
                      <span className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                        Admin
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{u.email}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {u.memberships.length === 0
                      ? "—"
                      : u.memberships
                          .map((m) => `${m.site.name} (${ROLE_LABEL[m.role]})`)
                          .join(", ")}
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {u.lastLoginAt
                      ? u.lastLoginAt.toISOString().slice(0, 10)
                      : "Never"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                        u.active
                          ? "bg-emerald-100 text-emerald-800 ring-emerald-300"
                          : "bg-slate-100 text-slate-600 ring-slate-300"
                      }`}
                    >
                      {u.active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ToggleUserButton
                      userId={u.id}
                      active={u.active}
                      disabled={u.isAdmin && u.active && activeAdmins <= 1}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <CreateUserForm />
      {sites.length > 0 ? (
        <MembershipForm
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        />
      ) : null}
      <ResetPasswordForm users={users.map((u) => ({ id: u.id, name: u.name }))} />
    </div>
  );
}
