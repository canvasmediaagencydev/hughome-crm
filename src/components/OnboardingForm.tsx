'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { IoHome } from "react-icons/io5";
import { FaUsers } from "react-icons/fa";
import axios from 'axios'
import { UserSessionManager } from '@/lib/user-session'

interface OnboardingFormData {
  role: 'homeowner' | 'contractor'
  first_name: string
  last_name: string
  phone: string
}

const OTP_RESEND_SECONDS = 60

export default function OnboardingForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState<OnboardingFormData>({
    role: 'homeowner',
    first_name: '',
    last_name: '',
    phone: '',
  })

  const [validationErrors, setValidationErrors] = useState<Partial<OnboardingFormData>>({})

  // OTP states
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const startCountdown = () => {
    setCountdown(OTP_RESEND_SECONDS)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const validateForm = (): boolean => {
    const errors: Partial<OnboardingFormData> = {}

    if (!formData.first_name.trim()) {
      errors.first_name = 'กรุณาใส่ชื่อจริง'
    }

    if (!formData.last_name.trim()) {
      errors.last_name = 'กรุณาใส่นามสกุล'
    }

    if (!formData.phone.trim()) {
      errors.phone = 'กรุณาใส่เบอร์โทรศัพท์'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSendOtp = async () => {
    setOtpError('')
    if (!formData.phone.trim()) {
      setValidationErrors(prev => ({ ...prev, phone: 'กรุณาใส่เบอร์โทรศัพท์' }))
      return
    }

    setIsSendingOtp(true)
    try {
      const res = await axios.post('/api/phone/send-otp', { phone: formData.phone })
      if (res.data.success) {
        setOtpSent(true)
        setOtpCode('')
        setPhoneVerified(false)
        startCountdown()
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setOtpError(err.response?.data?.error || 'ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่')
      } else {
        setOtpError('ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่')
      }
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    setOtpError('')
    if (!otpCode.trim() || otpCode.length < 4) {
      setOtpError('กรุณาใส่รหัส OTP ให้ครบ')
      return
    }

    setIsVerifyingOtp(true)
    try {
      const res = await axios.post('/api/phone/verify-otp', { phone: formData.phone, token: otpCode })
      if (res.data.success) {
        setPhoneVerified(true)
        setOtpSent(false)
        if (countdownRef.current) clearInterval(countdownRef.current)
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setOtpError(err.response?.data?.error || 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่')
      } else {
        setOtpError('รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่')
      }
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const handlePhoneChange = (value: string) => {
    setFormData(prev => ({ ...prev, phone: value }))
    setPhoneVerified(false)
    setOtpSent(false)
    setOtpCode('')
    setOtpError('')
    if (countdownRef.current) clearInterval(countdownRef.current)
    setCountdown(0)
    if (validationErrors.phone) {
      setValidationErrors(prev => ({ ...prev, phone: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    if (!phoneVerified) {
      setValidationErrors(prev => ({ ...prev, phone: 'กรุณายืนยันเบอร์โทรศัพท์ด้วย OTP ก่อน' }))
      return
    }

    setIsLoading(true)
    try {
      const storedUser = localStorage.getItem('user')
      if (!storedUser) {
        setError('ไม่พบข้อมูลผู้ใช้ กรุณาลองเข้าสู่ระบบใหม่')
        return
      }

      const userData = JSON.parse(storedUser)

      const response = await axios.post('/api/onboarding', {
        line_user_id: userData.line_user_id || userData.userId,
        ...formData
      })

      const data = response.data

      if (data.success && data.user) {
        const updatedUserData = {
          ...userData,
          ...data.user
        }

        localStorage.setItem('user', JSON.stringify(updatedUserData))
        UserSessionManager.saveSession(updatedUserData)
        router.push('/dashboard')
      } else {
        setError(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
      }
    } catch (err) {
      console.error('Onboarding error:', err)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (field: keyof OnboardingFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className="flex items-center justify-center px-4">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white px-6 sm:p-8 py-3">
          <div className="text-center mb-8">
            <Image
              src="/image/HUG HOME LOGO.svg"
              alt="Hughome Logo"
              width={250}
              height={64}
              className="mx-auto mb-4"
            />
            <p className="text-gray-500 text-sm">
              กรุณากรอกข้อมูลเพื่อเริ่มใช้งาน
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="grid grid-cols-2 gap-3">
                <label className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors ${formData.role === 'homeowner'
                    ? 'border-red-500 bg-red-100'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}>
                  <input
                    type="radio"
                    name="role"
                    value="homeowner"
                    checked={formData.role === 'homeowner'}
                    onChange={(e) => handleChange('role', e.target.value as 'homeowner')}
                    className="sr-only"
                  />
                  <div className="flex flex-col items-center justify-center text-center w-full">
                    <IoHome className="w-8 h-8 mb-3 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">
                      เจ้าของบ้าน
                    </span>
                  </div>
                </label>

                <label className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors ${formData.role === 'contractor'
                    ? 'border-red-500 bg-red-100'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}>
                  <input
                    type="radio"
                    name="role"
                    value="contractor"
                    checked={formData.role === 'contractor'}
                    onChange={(e) => handleChange('role', e.target.value as 'contractor')}
                    className="sr-only"
                  />
                  <div className="flex flex-col items-center justify-center text-center w-full">
                    <FaUsers className="w-8 h-8 mb-3 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">
                      ผู้รับเหมา
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                ชื่อจริง <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                className={`w-full px-3 py-3 border rounded-lg text-base focus:outline-none transition-colors ${validationErrors.first_name
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 bg-white'
                  }`}
                placeholder="กรอกชื่อจริง"
                maxLength={100}
              />
              {validationErrors.first_name && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.first_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                นามสกุล <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                className={`w-full px-3 py-3 border rounded-lg text-base focus:outline-none transition-colors ${validationErrors.last_name
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 bg-white'
                  }`}
                placeholder="กรอกนามสกุล"
                maxLength={100}
              />
              {validationErrors.last_name && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.last_name}</p>
              )}
            </div>

            {/* Phone + OTP */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                เบอร์โทรศัพท์ <span className="text-red-500">*</span>
              </label>

              <div className="flex gap-2">
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  disabled={phoneVerified}
                  className={`flex-1 px-3 py-3 border rounded-lg text-base focus:outline-none transition-colors ${
                    phoneVerified
                      ? 'border-green-400 bg-green-50 text-green-800'
                      : validationErrors.phone
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300 bg-white'
                  }`}
                  placeholder="0xx-xxx-xxxx"
                  maxLength={20}
                />
                {!phoneVerified && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSendingOtp || countdown > 0 || !formData.phone.trim()}
                    className="shrink-0 px-3 py-3 bg-red-700 text-white text-sm font-medium rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {isSendingOtp
                      ? 'กำลังส่ง...'
                      : countdown > 0
                        ? `ส่งใหม่ (${countdown}s)`
                        : otpSent
                          ? 'ส่งใหม่'
                          : 'ส่ง OTP'}
                  </button>
                )}
              </div>

              {phoneVerified && (
                <div className="mt-2 flex items-center gap-1.5 text-green-700 text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  ยืนยันเบอร์โทรศัพท์สำเร็จ
                </div>
              )}

              {validationErrors.phone && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.phone}</p>
              )}

              {/* OTP input */}
              {otpSent && !phoneVerified && (
                <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                  <p className="text-sm text-gray-600">
                    ส่งรหัส OTP ไปยัง <span className="font-medium text-gray-800">{formData.phone}</span> แล้ว
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={otpCode}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                        setOtpCode(v)
                        setOtpError('')
                      }}
                      className={`flex-1 px-3 py-3 border rounded-lg text-base text-center tracking-widest font-mono focus:outline-none transition-colors ${
                        otpError ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                      }`}
                      placeholder="รหัส OTP"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={isVerifyingOtp || otpCode.length < 4}
                      className="shrink-0 px-4 py-3 bg-red-700 text-white text-sm font-medium rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {isVerifyingOtp ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
                    </button>
                  </div>
                  {otpError && (
                    <p className="text-xs text-red-600">{otpError}</p>
                  )}
                </div>
              )}

              {/* OTP send error (before OTP sent) */}
              {!otpSent && otpError && (
                <p className="mt-1 text-xs text-red-600">{otpError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !phoneVerified}
              className="w-full bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-3 text-base"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                'เริ่มใช้งาน'
              )}
            </button>

            <p className="text-sm text-gray-500 text-center mb-4">
              กรุณากรอกข้อมูลตามความจริง เพื่อให้เราสามารถติดต่อและให้บริการที่ดีที่สุดแก่คุณได้
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
