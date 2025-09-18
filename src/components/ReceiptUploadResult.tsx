'use client'

import React, { useState, useEffect } from 'react'
import { IoMdCheckmarkCircle, IoMdCloseCircle, IoMdCamera, IoMdClose } from 'react-icons/io'
import { HiOutlineReceiptRefund } from 'react-icons/hi'

interface OCRResult {
  ชื่อร้าน: boolean
  ยอดรวม: number
  วันที่: string
  ความถูกต้อง: number
}

interface ReceiptUploadResultProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onRetake: () => void
  isLoading: boolean
  ocrResult: OCRResult | null
  error: string | null
}

export default function ReceiptUploadResult({
  isOpen,
  onClose,
  onConfirm,
  onRetake,
  isLoading,
  ocrResult,
  error
}: ReceiptUploadResultProps) {
  if (!isOpen) return null

  if (isLoading) {
    const LoadingWithProgress = () => {
      const [progress, setProgress] = useState(0)
      const [stage, setStage] = useState('เริ่มต้น...')

      useEffect(() => {
        const stages = [
          { progress: 15, stage: 'อัพโหลดรูป...' },
          { progress: 35, stage: 'วิเคราะห์ภาพ...' },
          { progress: 65, stage: 'อ่านข้อความ...' },
          { progress: 85, stage: 'ตรวจสอบร้าน...' },
          { progress: 95, stage: 'เกือบเสร็จ...' }
        ]

        let currentStage = 0
        const interval = setInterval(() => {
          if (currentStage < stages.length) {
            setProgress(stages[currentStage].progress)
            setStage(stages[currentStage].stage)
            currentStage++
          }
        }, 600) // เปลี่ยนทุก 600ms

        return () => clearInterval(interval)
      }, [])

      return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 mx-4 max-w-md w-full">
            <div className="text-center">
              <div className="relative mb-6">
                <div className="w-20 h-20 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <HiOutlineReceiptRefund className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">กำลังประมวลผล</h3>
              <p className="text-gray-600 mb-4">{stage}</p>

              {/* Animated Progress Bar */}
              <div className="relative">
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-red-400 to-red-600 relative transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  >
                    {/* Shine effect */}
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                      style={{
                        animation: 'progressShine 1.5s linear infinite'
                      }}
                    ></div>
                  </div>
                </div>

                {/* Progress percentage */}
                <div className="mt-2 flex justify-between items-center">
                  <span className="text-sm text-gray-500 font-medium">{stage}</span>
                  <span className="text-sm text-red-600 font-bold">{progress}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return <LoadingWithProgress />
  }

  if (error) {
    const isDuplicateError = error.includes('พบใบเสร็จซ้ำ') || error.includes('ไฟล์รูปภาพซ้ำ')

    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 mx-4 max-w-md w-full">
          <div className="text-center">
            <IoMdCloseCircle className={`w-16 h-16 mx-auto mb-4 ${isDuplicateError ? 'text-orange-500' : 'text-red-500'}`} />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {isDuplicateError ? 'ใบเสร็จซ้ำ' : 'เกิดข้อผิดพลาด'}
            </h3>
            <p className="text-gray-600 mb-6">{error}</p>

            {isDuplicateError && (
              <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-200">
                <p className="text-orange-700 text-sm">
                  💡 <strong>คำแนะนำ:</strong> กรุณาตรวจสอบใบเสร็จที่อัพโหลดแล้ว หรือลองถ่ายใบเสร็จใหม่
                </p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={onRetake}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                ถ่ายใหม่
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-xl transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!ocrResult) return null

  const confidencePercentage = Math.round(ocrResult.ความถูกต้อง * 100)
  const isHighConfidence = ocrResult.ความถูกต้อง >= 0.8

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-2xl p-6 mx-4 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">ผลการอ่านใบเสร็จ</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <IoMdClose className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Warning for wrong store */}
        {!ocrResult.ชื่อร้าน && (
          <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-200">
            <div className="flex items-start space-x-3">
              <IoMdCloseCircle className="w-6 h-6 text-red-500 mt-0.5" />
              <div>
                <p className="text-red-700 font-medium">⚠️ ใบเสร็จนี้ไม่ใช่จากร้าน "ตั้งหง่วงเซ้ง"</p>
                <p className="text-red-600 text-sm mt-1">
                  ใบเสร็จจากร้านอื่นอาจไม่ได้รับอนุมัติคะแนน คุณต้องการส่งต่อไปหรือถ่ายใหม่?
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success message for correct store */}
        {ocrResult.ชื่อร้าน && (
          <div className="mb-6 p-4 bg-green-50 rounded-xl border border-green-200">
            <div className="flex items-center space-x-3">
              <IoMdCheckmarkCircle className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-green-700 font-medium">✅ ใบเสร็จจากร้าน "ตั้งหง่วงเซ้ง"</p>
                <p className="text-green-600 text-sm">มีสิทธิ์ได้รับคะแนนหลังจากแอดมินอนุมัติ</p>
              </div>
            </div>
          </div>
        )}

        {/* OCR Results */}
        <div className="space-y-4 mb-6">
          

          {/* Total Amount */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium text-gray-900">ยอดรวม</p>
              <p className="text-sm text-gray-600">จำนวนเงินทั้งหมด</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">
                ฿{ocrResult.ยอดรวม.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <p className="font-medium text-gray-900">วันที่</p>
              <p className="text-sm text-gray-600">วันที่ในใบเสร็จ</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-900">{ocrResult.วันที่}</p>
            </div>
          </div>

          {/* Confidence */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-gray-900">ความแม่นยำ</p>
              <span className={`text-sm font-semibold ${isHighConfidence ? 'text-green-600' : 'text-yellow-600'}`}>
                {confidencePercentage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 relative overflow-hidden">
              <div
                className={`h-3 rounded-full ${
                  isHighConfidence ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-yellow-400 to-yellow-600'
                }`}
                style={{
                  width: `${confidencePercentage}%`,
                  animation: `progressFill 2s ease-out forwards`,
                  '--progress-width': `${confidencePercentage}%`
                } as React.CSSProperties}
              >
                {/* Progress bar shine effect */}
                <div
                  className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  style={{
                    animation: 'progressShine 2s infinite',
                    animationDelay: '0.5s'
                  }}
                ></div>
              </div>

            </div>
            <p className="text-xs text-gray-500 mt-2">
              {isHighConfidence ? 'ความแม่นยำสูง' : 'ความแม่นยำปานกลาง'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={onRetake}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
          >
            <IoMdCamera className="w-5 h-5" />
            <span>ถ่ายใหม่</span>
          </button>

          <button
            onClick={onConfirm}
            className={`flex-1 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2 ${
              ocrResult.ชื่อร้าน
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            <IoMdCheckmarkCircle className="w-5 h-5" />
            <span>{ocrResult.ชื่อร้าน ? 'ยืนยัน' : 'ส่งต่อไป'}</span>
          </button>
        </div>

        {/* Note */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700">
            <strong>หมายเหตุ:</strong> ระบบจะตรวจสอบข้อมูลและให้คะแนนหลังจากที่ admin อนุมัติใบเสร็จ
          </p>
        </div>
      </div>
    </div>
  )
}