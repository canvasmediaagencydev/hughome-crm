import { memo } from 'react'
import { IoSparkles, IoGift } from "react-icons/io5"

interface HeaderSectionProps {
  firstName?: string
  lastName?: string
  userRole?: string
}

export const HeaderSection = memo(({ firstName, lastName, userRole }: HeaderSectionProps) => {
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'สวัสดีตอนเช้า'
    if (hour < 18) return 'สวัสดีตอนบ่าย'
    return 'สวัสดีตอนเย็น'
  }

  const getRoleText = (role?: string) => {
    if (role === 'contractor') return 'ผู้รับเหมา'
    if (role === 'homeowner') return 'เจ้าของบ้าน'
    return 'สมาชิก'
  }

  const getFullName = () => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`
    }
    if (firstName) return firstName
    if (lastName) return lastName
    return 'ผู้ใช้งาน'
  }

  return (
    <div className="relative bg-gradient-to-br from-red-600 via-red-500 to-orange-500 overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute top-20 -left-10 w-32 h-32 bg-yellow-300/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 right-1/3 w-24 h-24 bg-orange-300/10 rounded-full blur-xl"></div>
      </div>

      {/* Content */}
      <div className="relative px-6 pt-8 pb-6">

        {/* Greeting Section */}
        <div className="space-y-3">
          <p className="text-white/80 text-sm font-medium">{getGreeting()}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-white font-bold text-3xl leading-tight">
              {getFullName()}
            </h2>
            <div className="inline-flex items-center bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
              <span className="text-white text-sm font-medium">
                {getRoleText(userRole)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Wave Bottom Border */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1200 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-6">
          <path d="M0 20C150 35 350 35 600 20C850 5 1050 5 1200 20V40H0V20Z" fill="#F9FAFB"/>
        </svg>
      </div>
    </div>
  )
})

HeaderSection.displayName = 'HeaderSection'
