'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from './AuthProvider'
import type { OnboardingFormData } from '@/types/user'
import Image from 'next/image'
import { IoHome } from "react-icons/io5";
import { FaUsers } from "react-icons/fa";

export default function OnboardingForm() {
  const { updateProfile, isLoading, error, clearError } = useAuthContext()
  const router = useRouter()

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
    } else if (formData.first_name.trim().length < 1 || formData.first_name.trim().length > 100) {
      errors.first_name = 'กรุณาใส่ชื่อจริง'
    }

    if (!formData.last_name.trim()) {
      errors.last_name = 'กรุณาใส่นามสกุล'
    } else if (formData.last_name.trim().length < 1 || formData.last_name.trim().length > 100) {
      errors.last_name = 'กรุณาใส่นามสกุล'
    }

    if (!formData.phone.trim()) {
      errors.phone = 'กรุณาใส่เบอร์โทรศัพท์'
    } else {
      const phoneRegex = /^[\+]?[\d\-\s\(\)]+$/
      if (!phoneRegex.test(formData.phone) || formData.phone.length < 10 || formData.phone.length > 20) {
        errors.phone = 'กรุณาใส่เบอร์โทรศัพท์ที่ถูกต้อง'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!validateForm()) {
      return
    }

    try {
      await updateProfile(formData)
      console.log('✅ Profile updated successfully, user should be onboarded now')
      
      // Force immediate redirect to dashboard - the user state will be updated
      // and dashboard will handle authentication checks
      console.log('🔄 Redirecting to dashboard...')
      window.location.href = '/dashboard'
    } catch (err) {
      // Error is handled by the useAuth hook
      console.error('Onboarding error:', err)
    }
  }

  const handleChange = (field: keyof OnboardingFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className="flex items-center justify-center px-4">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white px-6 sm:p-8 py-3">
          {/* Header */}
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

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Role Selection */}
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

            {/* First Name */}
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

            {/* Last Name */}
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

            {/* Phone */}
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



            {/* Submit Button */}
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