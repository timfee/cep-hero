/**
 * Dashboard loading skeleton for use with Suspense boundaries.
 * Matches the visual structure of DashboardOverview for seamless loading transitions.
 */

"use client";

import { SkeletonShimmer } from "@/components/ai-elements/shimmer";

/**
 * Skeleton placeholder matching the DashboardOverview layout.
 * Displays prominent shimmer effects while content loads.
 */
export function DashboardSkeleton() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-16">
        <header className="mb-16">
          <div className="flex items-start justify-between gap-4">
            <SkeletonShimmer height={40} width="75%" className="rounded-lg" />
            <SkeletonShimmer
              height={40}
              width={96}
              className="flex-shrink-0 rounded-lg"
            />
          </div>
          <div className="mt-5 space-y-3">
            <SkeletonShimmer height={20} width="100%" className="rounded" />
            <SkeletonShimmer height={20} width="92%" className="rounded" />
            <SkeletonShimmer height={20} width="80%" className="rounded" />
          </div>
        </header>

        <section>
          <SkeletonShimmer height={16} width={96} className="mb-6 rounded" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <SkeletonShimmer
                key={i}
                height={96}
                className="rounded-2xl border border-white/10"
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
