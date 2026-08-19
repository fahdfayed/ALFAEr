import Link from "next/link";

import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NoProjectsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-2xl font-bold tracking-tight">No projects yet</h1>
      <p className="mt-2 text-sm text-slate-500">
        {user.isAdmin
          ? "Create the first project and it will open here."
          : "You have not been added to a project. Ask an administrator to give you access."}
      </p>
      {user.isAdmin ? (
        <Link href="/admin/projects" className="btn-primary mt-6">
          Create a project
        </Link>
      ) : null}
    </div>
  );
}
