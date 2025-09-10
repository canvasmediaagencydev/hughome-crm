'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { IoHome } from "react-icons/io5";
import { FaUsers } from "react-icons/fa";

interface OnboardingFormData {
  role: 'homeowner' | 'contractor'
  first_name: string
  last_name: string
  phone: string
}

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    try {
      // Get user data from localStorage to get LINE user ID
      const storedUser = localStorage.getItem('user')
      if (!storedUser) {
        setError('ไม่พบข้อมูลผู้ใช้ กรุณาลองเข้าสู่ระบบใหม่')
        return
      }

      const userData = JSON.parse(storedUser)
      
      // Send onboarding data to API
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          line_user_id: userData.line_user_id || userData.userId,
          ...formData
        })
      })

      const data = await response.json()
      
      if (data.success && data.user) {
        // Update localStorage with complete user data
        localStorage.setItem('user', JSON.stringify({
          ...userData,
          ...data.user
        }))
        
        // Redirect to dashboard
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

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                เบอร์โทรศัพท์ <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={`w-full px-3 py-3 border rounded-lg text-base focus:outline-none transition-colors ${validationErrors.phone
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 bg-white'
                  }`}
                placeholder="0xx-xxx-xxxx"
                maxLength={20}
              />
              {validationErrors.phone && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.phone}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
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