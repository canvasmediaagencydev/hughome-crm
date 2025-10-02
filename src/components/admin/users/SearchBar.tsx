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
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร..."
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            onKeyPress={onKeyPress}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={onSearch}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          ค้นหา
        </button>
        {searchQuery && (
          <button
            onClick={onClear}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            ล้าง
          </button>
        )}
      </div>
      {searchQuery && (
        <p className="text-sm text-gray-600 mt-2">
          กำลังค้นหา: <span className="font-semibold">"{searchQuery}"</span>
        </p>
      )}
    </div>
  )
}
