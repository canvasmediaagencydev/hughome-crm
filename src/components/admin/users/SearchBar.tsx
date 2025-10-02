import { HiSearch } from 'react-icons/hi'

interface SearchBarProps {
  searchInput: string
  searchQuery: string
  onSearchInputChange: (value: string) => void
  onSearch: () => void
  onClear: () => void
  onKeyPress: (e: React.KeyboardEvent) => void
}

export function SearchBar({
  searchInput,
  searchQuery,
  onSearchInputChange,
  onSearch,
  onClear,
  onKeyPress
}: SearchBarProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 shadow-sm">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร..."
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            onKeyPress={onKeyPress}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all bg-white"
          />
        </div>
        <button
          onClick={onSearch}
          className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium shadow-sm"
        >
          ค้นหา
        </button>
        {searchQuery && (
          <button
            onClick={onClear}
            className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            ล้าง
          </button>
        )}
      </div>
      {searchQuery && (
        <p className="text-sm text-slate-600 mt-2">
          กำลังค้นหา: <span className="font-semibold text-slate-900">"{searchQuery}"</span>
        </p>
      )}
    </div>
  )
}
