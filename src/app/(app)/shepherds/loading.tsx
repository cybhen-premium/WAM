import { Compass } from "lucide-react";

export default function ShepherdsLoading() {
  return (
    <div className="space-y-6 animate-pulse p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700">
              <Compass className="h-5 w-5 animate-spin" />
            </div>
            <div>
              <div className="h-6 w-48 bg-slate-200 rounded-lg" />
              <div className="h-4 w-72 bg-slate-100 rounded-lg mt-1" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-28 bg-slate-200 rounded-xl" />
          <div className="h-10 w-36 bg-blue-200 rounded-xl" />
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-3xl border border-slate-100 bg-white p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-slate-100 rounded" />
              <div className="h-8 w-8 rounded-xl bg-slate-100" />
            </div>
            <div className="h-7 w-14 bg-slate-200 rounded-md" />
            <div className="h-3 w-28 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Filter and Search Bar Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="h-10 w-full sm:w-72 bg-slate-200 rounded-2xl" />
        <div className="h-9 w-48 bg-slate-100 rounded-xl" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="h-12 bg-slate-50 border-b border-slate-200 flex items-center px-6">
          <div className="h-3 w-32 bg-slate-200 rounded" />
        </div>
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 sm:px-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-200" />
                <div className="space-y-1.5">
                  <div className="h-4 w-36 bg-slate-200 rounded" />
                  <div className="h-3 w-24 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-4 w-28 bg-slate-100 rounded hidden sm:block" />
              <div className="h-6 w-24 bg-blue-100 rounded-xl hidden md:block" />
              <div className="h-6 w-16 bg-emerald-100 rounded-full" />
              <div className="h-8 w-16 bg-slate-100 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
