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
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="flex flex-wrap gap-2">
        {roleTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onRoleChange(tab.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeRole === tab.value
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
