import Link from "next/link";

import { prisma } from "@/lib/db";
import { requireAccess } from "@/lib/auth/access";
import { auditValue, fieldLabel, type ChangeSet } from "@/lib/audit";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const ACTION_CHIP: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  UPDATE: "bg-blue-100 text-blue-800 ring-blue-300",
  DELETE: "bg-red-100 text-red-800 ring-red-300",
};

function when(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const { site } = await requireAccess();

  const perPage = 50;
  const page = Math.max(1, Number(sp.page) || 1);

  const where = {
    siteId: site.id,
    ...(sp.entity ? { entity: sp.entity } : {}),
  };

  const [entries, total, entities] = await Promise.all([
    prisma.auditEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.auditEntry.count({ where }),
    prisma.auditEntry.groupBy({
      by: ["entity"],
      where: { siteId: site.id },
      _count: true,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit trail</h1>
        <p className="mt-1 text-sm text-slate-500">
          Who changed what, and from what to what. {total} entr
          {total === 1 ? "y" : "ies"} for {site.name}.
        </p>
      </div>

      <nav className="no-print flex flex-wrap gap-2">
        <Link
          href="/audit"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            !sp.entity
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100"
          }`}
        >
          Everything
        </Link>
        {entities.map((e) => (
          <Link
            key={e.entity}
            href={`/audit?entity=${e.entity}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              sp.entity === e.entity
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100"
            }`}
          >
            {e.entity}{" "}
            <span className="opacity-60">{e._count}</span>
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          body="Every change to a pile log, delay or setting will appear here with the values before and after."
        />
      ) : (
        <div className="card divide-y divide-slate-100">
          {entries.map((e) => {
            const changes = (e.changes ?? null) as ChangeSet | null;
            return (
              <div key={e.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                      ACTION_CHIP[e.action] ?? "bg-slate-100 text-slate-700 ring-slate-300"
                    }`}
                  >
                    {e.action}
                  </span>
                  <span className="font-medium">
                    {e.entity} {e.entityLabel}
                  </span>
                  <span className="text-sm text-slate-500">
                    by {e.actorName} · {when(e.createdAt)}
                  </span>
                </div>

                {e.reason ? (
                  <p className="mt-2 text-sm italic text-slate-600">{e.reason}</p>
                ) : null}

                {changes && Object.keys(changes).length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {Object.entries(changes).map(([field, change]) => (
                      <li key={field} className="flex flex-wrap gap-2">
                        <span className="text-slate-500">{fieldLabel(field)}:</span>
                        <span className="text-red-700 line-through">
                          {auditValue(change.from)}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="font-medium text-emerald-800">
                          {auditValue(change.to)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between">
          <Link
            href={`/audit?${sp.entity ? `entity=${sp.entity}&` : ""}page=${page - 1}`}
            className={`btn-secondary ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            ← Newer
          </Link>
          <span className="text-sm text-slate-500">
            Page {page} of {pages}
          </span>
          <Link
            href={`/audit?${sp.entity ? `entity=${sp.entity}&` : ""}page=${page + 1}`}
            className={`btn-secondary ${page >= pages ? "pointer-events-none opacity-40" : ""}`}
          >
            Older →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
