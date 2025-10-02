import { memo } from 'react'
import { IoMdCamera } from "react-icons/io"

interface UploadSectionProps {
  onCameraOpen: () => void
}

export const UploadSection = memo(({ onCameraOpen }: UploadSectionProps) => (
  <div className="bg-gray-50 px-6 mt-10 pb-24">
    <div className="space-y-4">
      <div className="text-center mb-6">
        <p className="text-sm text-gray-600">ถ่ายรูปหรือเลือกรูปใบเสร็จเพื่อสะสมแต้ม</p>
      </div>

      <button
        onClick={onCameraOpen}
        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
      >
        <div className="bg-white/20 p-2 rounded-full">
          <IoMdCamera className="w-6 h-6" />
        </div>
        <span className="text-lg">อัพโหลดใบเสร็จ</span>
      </button>
    </div>
  </div>
))

UploadSection.displayName = 'UploadSection'
