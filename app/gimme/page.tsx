/**
 * Self-enrollment page for creating admin accounts in the cep-netnew.cc domain.
 */

import Image from "next/image";

import { EnrollmentForm } from "./enrollment-form";

/**
 * Self-enrollment page that allows Google employees to create admin accounts.
 */
export default function GimmePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <Image src="/icon.png" alt="CEP Hero" height={50} width={50} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Self-Enrollment
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a super admin account for cep-netnew.cc
          </p>
        </div>

        <EnrollmentForm />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          This creates a Google Workspace admin account for testing Chrome
          Enterprise Premium. You must have a valid @google.com email address.
        </p>
      </div>
    </main>
  );
}
