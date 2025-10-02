import { memo } from 'react'
import { IoMdArrowBack, IoMdArrowForward } from "react-icons/io"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  maxVisiblePages?: number
  disabled?: boolean
}

export const Pagination = memo(({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 5,
  disabled = false
}: PaginationProps) => {
  if (totalPages <= 1) return null

  const getPageNumbers = () => {
    const pages: number[] = []
    const showPages = Math.min(totalPages, maxVisiblePages)

    let startPage = Math.max(1, currentPage - Math.floor(showPages / 2))
    let endPage = Math.min(totalPages, startPage + showPages - 1)

    if (endPage - startPage + 1 < showPages) {
      startPage = Math.max(1, endPage - showPages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    return pages
  }

  return (
    <div className="flex items-center justify-center space-x-2 py-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || disabled}
        className={`p-2 rounded-lg transition-colors ${
          currentPage === 1 || disabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
        }`}
      >
        <IoMdArrowBack className="w-5 h-5" />
      </button>

      <div className="flex items-center space-x-1">
        {getPageNumbers().map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentPage === page
                ? 'bg-slate-900 text-white'
                : disabled
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            {page}
          </button>
        ))}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || disabled}
        className={`p-2 rounded-lg transition-colors ${
          currentPage === totalPages || disabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
        }`}
      >
        <IoMdArrowForward className="w-5 h-5" />
      </button>
    </div>
  )
})
Pagination.displayName = 'Pagination'

interface SimplePaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
  prevLabel?: string
  nextLabel?: string
}

export const SimplePagination = memo(({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  prevLabel = 'ก่อนหน้า',
  nextLabel = 'ถัดไป'
}: SimplePaginationProps) => {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || disabled}
        className={`px-3 py-1 rounded text-sm ${
          currentPage === 1 || disabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
      >
        {prevLabel}
      </button>
      <span className="text-sm text-slate-600">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || disabled}
        className={`px-3 py-1 rounded text-sm ${
          currentPage === totalPages || disabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
      >
        {nextLabel}
      </button>
    </div>
  )
})
SimplePagination.displayName = 'SimplePagination'
