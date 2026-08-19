import Link from "next/link";

import { requireAccess } from "@/lib/auth/access";
import { ROLE_LABEL } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export default async function ForbiddenPage() {
  const access = await requireAccess();

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Not your call</h1>
      <p className="mt-2 text-sm text-slate-500">
        You are signed in as {access.user.name} with the{" "}
        <strong>{ROLE_LABEL[access.role]}</strong> role on {access.site.name},
        which does not cover that action. An engineer on this project can do it,
        or change your role.
      </p>
      <Link href="/" className="btn-primary mt-6">
        Back to today
      </Link>
    </div>
  );
}
