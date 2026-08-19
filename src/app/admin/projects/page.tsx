import Link from "next/link";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/access";
import { ArchiveProjectButton, CreateProjectForm } from "@/components/AdminForms";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  await requireAdmin();

  const sites = await prisma.site.findMany({
    orderBy: [{ archived: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { piles: true, memberships: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">
            Each contract is its own project. Archived projects stay readable
            but drop out of the switcher.
          </p>
        </div>
        <Link href="/admin/users" className="btn-secondary">
          People
        </Link>
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Project</th>
                <th className="px-4 py-2 font-semibold">Client</th>
                <th className="px-4 py-2 font-semibold">Contract</th>
                <th className="px-4 py-2 text-right font-semibold">Piles</th>
                <th className="px-4 py-2 text-right font-semibold">People</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2 text-slate-600">{s.clientName ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{s.contractRef ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s._count.piles}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {s._count.memberships}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                        s.archived
                          ? "bg-slate-100 text-slate-600 ring-slate-300"
                          : "bg-emerald-100 text-emerald-800 ring-emerald-300"
                      }`}
                    >
                      {s.archived ? "Archived" : "Live"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ArchiveProjectButton siteId={s.id} archived={s.archived} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <CreateProjectForm />
    </div>
  );
}
