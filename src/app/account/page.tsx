import { prisma } from "@/lib/db";
import { requireAccess } from "@/lib/auth/access";
import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/auth/roles";
import { ChangePasswordForm } from "@/components/AuthForms";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const access = await requireAccess();

  const memberships = await prisma.membership.findMany({
    where: { userId: access.user.id },
    include: { site: true },
    orderBy: { site: { name: "asc" } },
  });

  const sessions = await prisma.session.count({ where: { userId: access.user.id } });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{access.user.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {access.user.email}
          {access.user.isAdmin ? " · System administrator" : ""}
        </p>
      </div>

      <section className="card p-4 sm:p-5">
        <h2 className="section-title">Your projects</h2>
        {memberships.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            {access.user.isAdmin
              ? "You hold no project memberships. As an administrator you can still open every project."
              : "You have not been added to a project yet."}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {memberships.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{m.site.name}</span>
                <span className="text-slate-500">
                  {ROLE_LABEL[m.role]} — {ROLE_DESCRIPTION[m.role]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ChangePasswordForm />

      <p className="text-xs text-slate-500">
        {sessions} signed-in device{sessions === 1 ? "" : "s"}. Changing your
        password signs out all of them.
      </p>
    </div>
  );
}
