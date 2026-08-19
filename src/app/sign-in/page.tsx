import { redirect } from "next/navigation";

import { needsBootstrap } from "@/lib/auth/access";
import { getSessionUser } from "@/lib/auth/session";
import { BootstrapForm, SignInForm } from "@/components/AuthForms";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getSessionUser()) redirect("/");
  const bootstrap = await needsBootstrap();

  return (
    <div className="mx-auto max-w-sm py-10">
      <div className="mb-6 text-center">
        <p className="text-2xl font-bold tracking-tight">
          ALFA<span className="text-amber-600">Er</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {bootstrap ? "Set up this installation" : "Bored pile site records"}
        </p>
      </div>

      <div className="card p-5">
        {bootstrap ? (
          <>
            <h1 className="mb-1 text-lg font-bold">Create the first account</h1>
            <p className="mb-4 text-sm text-slate-500">
              There are no users yet. This account will administer the system
              and can create projects and add everyone else.
            </p>
            <BootstrapForm />
          </>
        ) : (
          <>
            <h1 className="mb-4 text-lg font-bold">Sign in</h1>
            <SignInForm />
          </>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        Records created here form part of the contract documentation.
      </p>
    </div>
  );
}
