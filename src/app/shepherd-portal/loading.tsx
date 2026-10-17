import { Compass } from "lucide-react";

export default function ShepherdPortalLoading() {
  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 animate-pulse">
      {/* Top Header Skeleton */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700">
              <Compass className="h-5 w-5 animate-spin" />
            </div>
            <div className="space-y-1">
              <div className="h-4 w-36 bg-slate-200 rounded" />
              <div className="h-3 w-28 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-slate-100 rounded-xl" />
            <div className="h-9 w-9 rounded-xl bg-slate-200" />
          </div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Navigation Tabs Skeleton */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <div className="h-10 w-72 bg-slate-200/80 rounded-2xl" />
        </div>

        {/* Search Bar Skeleton */}
        <div className="h-11 w-full max-w-md bg-white border border-slate-200 rounded-2xl" />

        {/* Cards Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-slate-200" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-32 bg-slate-200 rounded" />
                  <div className="h-3 w-20 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-8 bg-slate-50 rounded-xl" />
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div className="h-8 bg-slate-100 rounded-xl" />
                <div className="h-8 bg-slate-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
