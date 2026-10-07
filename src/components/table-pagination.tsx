"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  useUrlParams?: boolean;
  className?: string;
}

export function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  useUrlParams = false,
  className,
}: TablePaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  const navigateTo = (newPage: number, newPageSize = pageSize) => {
    if (useUrlParams) {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("page", String(newPage));
      params.set("pageSize", String(newPageSize));
      router.push(`${pathname}?${params.toString()}`);
    } else {
      if (newPage !== safePage && onPageChange) {
        onPageChange(newPage);
      }
      if (newPageSize !== pageSize && onPageSizeChange) {
        onPageSizeChange(newPageSize);
      }
    }
  };

  const handlePageChange = (newPage: number) => {
    const clamped = Math.min(Math.max(1, newPage), totalPages);
    navigateTo(clamped, pageSize);
  };

  const handlePageSizeChange = (newSize: number) => {
    navigateTo(1, newSize);
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-white text-xs",
        className,
      )}
    >
      {/* Left side: Range information */}
      <div className="flex items-center gap-2 text-slate-500 font-medium">
        <span>
          Showing <span className="font-bold text-slate-900">{start}</span> to{" "}
          <span className="font-bold text-slate-900">{end}</span> of{" "}
          <span className="font-bold text-slate-900">{totalItems}</span> rows
        </span>
      </div>

      {/* Right side: Rows per page selector + Page Navigation */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Page size dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="table-page-size" className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Rows per page:
          </label>
          <select
            id="table-page-size"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handlePageChange(1)}
            disabled={safePage <= 1}
            title="First page"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors cursor-pointer"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => handlePageChange(safePage - 1)}
            disabled={safePage <= 1}
            title="Previous page"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="px-3 py-1 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl">
            Page {safePage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => handlePageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            title="Next page"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => handlePageChange(totalPages)}
            disabled={safePage >= totalPages}
            title="Last page"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors cursor-pointer"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Convenient React hook to paginate any array in client components.
 * Defaults to 50 items per page as requested by user.
 */
export function useTablePagination<T>({
  items,
  initialPageSize = 50,
  pageSizeOptions = [10, 25, 50, 100],
}: {
  items: T[];
  initialPageSize?: number;
  pageSizeOptions?: number[];
}) {
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, safePage, pageSize]);

  const Pagination = (
    <TablePagination
      currentPage={safePage}
      totalItems={items.length}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
      onPageChange={setCurrentPage}
      onPageSizeChange={(newSize) => {
        setPageSize(newSize);
        setCurrentPage(1);
      }}
    />
  );

  return {
    paginatedItems,
    currentPage: safePage,
    pageSize,
    totalItems: items.length,
    totalPages,
    setCurrentPage,
    setPageSize,
    Pagination,
  };
}
