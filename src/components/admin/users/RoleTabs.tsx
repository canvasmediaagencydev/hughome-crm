import { CheckSquare, X } from 'lucide-react'

interface RoleTab {
  value: string
  label: string
}

interface RoleTabsProps {
  activeRole: string
  onRoleChange: (role: string) => void
  isSelectionMode?: boolean
  onEnterSelection?: () => void
  onExitSelection?: () => void
}

const roleTabs: RoleTab[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'homeowner', label: 'Homeowner' }
]

export function RoleTabs({ activeRole, onRoleChange, isSelectionMode, onEnterSelection, onExitSelection }: RoleTabsProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap gap-2 flex-1">
          {roleTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => onRoleChange(tab.value)}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                activeRole === tab.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {(onEnterSelection || onExitSelection) && (
          <div className="flex-shrink-0">
            {isSelectionMode ? (
              <button
                onClick={onExitSelection}
                className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium text-sm"
              >
                <X className="w-4 h-4" />
                ยกเลิก
              </button>
            ) : (
              <button
                onClick={onEnterSelection}
                className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium text-sm"
              >
                <CheckSquare className="w-4 h-4" />
                เลือก
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
