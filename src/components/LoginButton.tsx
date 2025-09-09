'use client'

import { useAuth } from '@/hooks/useAuth'

interface LoginButtonProps {
  onLoginSuccess?: () => void
}

export default function LoginButton({ onLoginSuccess }: LoginButtonProps) {
  const { login, isLoading, error, clearError } = useAuth()

  const handleLogin = async () => {
    clearError()
    await login()
    if (onLoginSuccess) {
      onLoginSuccess()
    }
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="w-full bg-[#06c755] hover:bg-[#05b94c] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-3 text-base"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            กำลังเข้าสู่ระบบ...
          </>
        ) : (
          <>
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317c-.133-.18-.133-.509 0-.689l2.443-3.317c.119-.16.299-.25.51-.25.066 0 .135.01.199.031.258.086.432.326.432.596v2.54h2.789c.348 0 .629.283.629.630 0 .344-.282.629-.629.629h-2.789v2.540z" />
              <path d="M7.61 20.997c-.624 0-1.125-.501-1.125-1.125V4.129c0-.624.501-1.125 1.125-1.125h8.762c.624 0 1.125.501 1.125 1.125V6.51c0 .345-.282.63-.63.63-.345 0-.63-.285-.63-.63V4.759H8.24v14.508h7.997v-1.751c0-.344.285-.629.63-.629.348 0 .63.285.63.629v2.381c0 .624-.501 1.125-1.125 1.125H7.61z" />
            </svg>
            เข้าสู่ระบบด้วย LINE
          </>
        )}
      </button>
      
      <p className="text-sm text-gray-600 text-center">
        เข้าสู่ระบบเพื่อเริ่มใช้งาน Hughome CRM
      </p>
    </div>
  )
}