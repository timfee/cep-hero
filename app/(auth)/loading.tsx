export default function AuthLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo placeholder */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-pulse rounded-xl bg-muted" />
          <div className="mx-auto h-7 w-32 animate-pulse rounded bg-muted" />
          <div className="mx-auto mt-2 h-4 w-48 animate-pulse rounded bg-muted" />
        </div>

        {/* Card placeholder */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-6">
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-full animate-pulse rounded bg-muted" />
            <div className="mt-1 h-4 w-3/4 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-11 w-full animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </main>
  );
}
