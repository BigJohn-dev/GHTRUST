"use client";

import { useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchKey?: keyof T;
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (item: T) => void;
  filters?: React.ReactNode;
}

export function DataTable<T extends object>({
  data,
  columns,
  searchKey,
  searchPlaceholder = "Search...",
  pageSize = 8,
  onRowClick,
  filters,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = searchKey
    ? data.filter((item) => String((item as Record<string, unknown>)[searchKey as string]).toLowerCase().includes(search.toLowerCase()))
    : data;

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {searchKey && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30 focus:border-cyan text-sm"
            />
          </div>
        )}
        {filters}
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-light">
              {columns.map((col) => (
                <th key={col.key} className={`text-left px-4 py-3 font-semibold text-navy ${col.className || ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-8 text-gray-400">
                  No records found
                </td>
              </tr>
            ) : (
              paginated.map((item, i) => (
                <tr
                  key={i}
                  className={`border-t border-gray-50 hover:bg-bg-light/50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-gray-700 ${col.className || ""}`}>
                      {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
