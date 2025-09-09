'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from './AuthProvider'
import type { OnboardingFormData } from '@/types/user'

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
      errors.first_name = 'ชื่อจริงต้องมีความยาว 1-100 ตัวอักษร'
    }
    
    if (!formData.last_name.trim()) {
      errors.last_name = 'กรุณาใส่นามสกุล'
    } else if (formData.last_name.trim().length < 1 || formData.last_name.trim().length > 100) {
      errors.last_name = 'นามสกุลต้องมีความยาว 1-100 ตัวอักษร'
    }
    
    if (!formData.phone.trim()) {
      errors.phone = 'กรุณาใส่เบอร์โทรศัพท์'
    } else {
      const phoneRegex = /^[\+]?[\d\-\s\(\)]+$/
      if (!phoneRegex.test(formData.phone) || formData.phone.length < 10 || formData.phone.length > 20) {
        errors.phone = 'กรุณาใส่เบอร์โทรศัพท์ที่ถูกต้อง (10-20 หลัก)'
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
      // Success! User should be redirected by the AuthProvider
      router.push('/dashboard')
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-[#06c755] rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              ยินดีต้อนรับ!
            </h1>
            <p className="text-gray-600 text-sm">
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
              <label className="block text-sm font-medium text-gray-700 mb-3">
                ประเภทผู้ใช้งาน <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors ${
                  formData.role === 'homeowner' 
                    ? 'border-[#06c755] bg-green-50' 
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
                  <div className="flex flex-col items-center text-center">
                    <svg className="w-8 h-8 mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 8l2 2 4-4" />
                    </svg>
                    <span className="text-sm font-medium text-gray-900">
                      เจ้าของบ้าน
                    </span>
                    <span className="text-xs text-gray-500">
                      ต้องการบริการ
                    </span>
                  </div>
                </label>

                <label className={`relative flex cursor-pointer rounded-lg border p-4 transition-colors ${
                  formData.role === 'contractor' 
                    ? 'border-[#06c755] bg-green-50' 
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
                  <div className="flex flex-col items-center text-center">
                    <svg className="w-8 h-8 mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-900">
                      ผู้รับเหมา
                    </span>
                    <span className="text-xs text-gray-500">
                      ให้บริการ
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
                className={`w-full px-3 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-[#06c755] focus:border-transparent transition-colors ${
                  validationErrors.first_name 
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
                className={`w-full px-3 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-[#06c755] focus:border-transparent transition-colors ${
                  validationErrors.last_name 
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
                className={`w-full px-3 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-[#06c755] focus:border-transparent transition-colors ${
                  validationErrors.phone 
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
              className="w-full bg-[#06c755] hover:bg-[#05b94c] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-3 text-base"
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
          </form>
        </div>
      </div>
    </div>
  )
}