/**
 * Dashboard loading skeleton for use with Suspense boundaries.
 * Matches the visual structure of DashboardOverview for seamless loading.
 */
export function DashboardSkeleton() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-16">
        {/* Header skeleton */}
        <header className="mb-16">
          <div className="flex items-start justify-between gap-4">
            <div className="h-10 w-3/4 animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-24 flex-shrink-0 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="mt-5 space-y-2">
            <div className="h-5 w-full animate-pulse rounded bg-muted" />
            <div className="h-5 w-4/5 animate-pulse rounded bg-muted" />
          </div>
        </header>

        {/* Section skeleton */}
        <section>
          <div className="mb-6 h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border border-white/10 bg-muted"
                style={{
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
