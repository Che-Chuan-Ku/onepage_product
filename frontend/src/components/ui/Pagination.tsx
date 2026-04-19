'use client'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="px-3 py-1 border border-olive-200 text-olive-700 disabled:opacity-40 hover:bg-olive-50 text-sm"
      >
        上一頁
      </button>
      <span className="text-sm text-olive-600">
        {page + 1} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="px-3 py-1 border border-olive-200 text-olive-700 disabled:opacity-40 hover:bg-olive-50 text-sm"
      >
        下一頁
      </button>
    </div>
  )
}
