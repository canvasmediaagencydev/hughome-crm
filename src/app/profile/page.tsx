'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { UserSessionManager } from '@/lib/user-session'
import BottomNavigation from '@/components/BottomNavigation'
import LoadingSpinner from '@/components/LoadingSpinner'
import { FaUser, FaPhone } from 'react-icons/fa'
import { SiLine } from 'react-icons/si'

interface UserProfile {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  role: string | null
  display_name: string | null
  picture_url: string | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const cachedSession = UserSessionManager.getCachedSession()
    if (!cachedSession?.user) {
      router.push('/')
      return
    }

    setProfile({
      id: cachedSession.user.id,
      first_name: cachedSession.user.first_name,
      last_name: cachedSession.user.last_name,
      phone: cachedSession.user.phone,
      role: cachedSession.user.role,
      display_name: cachedSession.user.display_name,
      picture_url: cachedSession.user.picture_url
    })
    setIsLoading(false)
  }, [router])

  const getRoleText = (role?: string | null) => {
    if (role === 'contractor') return 'ผู้รับเหมา'
    if (role === 'homeowner') return 'เจ้าของบ้าน'
    return 'สมาชิก'
  }

  const getFullName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`
    }
    if (profile?.first_name) return profile.first_name
    if (profile?.last_name) return profile.last_name
    return 'ผู้ใช้งาน'
  }

  if (isLoading) {
    return <LoadingSpinner message="กำลังโหลดโปรไฟล์..." />
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header Section */}
      <div className="relative bg-gradient-to-br from-red-600 via-red-500 to-orange-500 overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute top-20 -left-10 w-32 h-32 bg-yellow-300/10 rounded-full blur-2xl"></div>
        </div>

        {/* Content */}
        <div className="relative px-6 pt-8 pb-24">
          {/* Profile Picture & Name */}
          <div className="flex flex-col items-center">
            <div className="relative w-32 h-32 mb-4">
              {profile?.picture_url ? (
                <Image
                  src={profile.picture_url}
                  alt="Profile"
                  fill
                  className="rounded-full object-cover border-4 border-white/20"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-white/20 flex items-center justify-center border-4 border-white/20">
                  <FaUser className="w-16 h-16 text-white/60" />
                </div>
              )}
            </div>

            <h2 className="text-white font-bold text-3xl text-center mb-2">
              {getFullName()}
            </h2>

            <div className="inline-flex items-center bg-white/15 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
              <span className="text-white font-medium">
                {getRoleText(profile?.role)}
              </span>
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

      {/* Info Cards */}
      <div className="px-6 mt-16 space-y-4">
        {/* Phone Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
              <FaPhone className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-gray-500 text-xs mb-1">เบอร์โทรศัพท์</p>
              <p className="text-gray-900 font-semibold text-lg">
                {profile?.phone || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* LINE Display Name Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
              <SiLine className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-gray-500 text-xs mb-1">LINE Display Name</p>
              <p className="text-gray-900 font-semibold text-lg">
                {profile?.display_name || '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="profile" />
    </div>
  )
}
