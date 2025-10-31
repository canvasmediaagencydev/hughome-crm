import { memo } from 'react'
import { useRouter } from 'next/navigation'
import { IoReceipt, IoGift, IoTime } from "react-icons/io5"

export const QuickActions = memo(() => {
  const router = useRouter()

  const actions = [
    {
      icon: IoReceipt,
      label: 'ประวัติใบเสร็จ',
      description: 'ดูใบเสร็จทั้งหมด',
      color: 'from-blue-500 to-blue-600',
      onClick: () => router.push('/history')
    },
    {
      icon: IoGift,
      label: 'แลกของรางวัล',
      description: 'ใช้แต้มแลกรางวัล',
      color: 'from-purple-500 to-purple-600',
      onClick: () => router.push('/rewards')
    },
    {
      icon: IoTime,
      label: 'ประวัติการแลก',
      description: 'รางวัลที่แลกไปแล้ว',
      color: 'from-emerald-500 to-emerald-600',
      onClick: () => router.push('/rewards?tab=history')
    }
  ]

  return (
    <div className="px-6 py-6">
      <div className="grid grid-cols-3 gap-3">
        {actions.map((action, index) => {
          const Icon = action.icon
          return (
            <button
              key={index}
              onClick={action.onClick}
              className="group relative bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 active:scale-95"
            >
              <div className={`w-12 h-12 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform duration-200`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-gray-800 font-medium text-xs text-center leading-tight">
                {action.label}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
})

QuickActions.displayName = 'QuickActions'
