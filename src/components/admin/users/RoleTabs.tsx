interface RoleTab {
  value: string
  label: string
}

interface RoleTabsProps {
  activeRole: string
  onRoleChange: (role: string) => void
}

const roleTabs: RoleTab[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'homeowner', label: 'Homeowner' }
]

export function RoleTabs({ activeRole, onRoleChange }: RoleTabsProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6 shadow-sm">
      <div className="flex flex-wrap gap-2">
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
    </div>
  )
}
