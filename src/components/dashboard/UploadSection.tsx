import { memo } from 'react'
import { IoMdCamera } from "react-icons/io"

interface UploadSectionProps {
  onCameraOpen: () => void
}

export const UploadSection = memo(({ onCameraOpen }: UploadSectionProps) => (
  <div className="px-6 pb-24">
    <div className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-sm text-gray-500">ถ่ายรูปหรือเลือกรูปใบเสร็จเพื่อสะสมแต้ม</p>
      </div>

      <button
        onClick={onCameraOpen}
        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-5 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
      >
        <div className="bg-white/20 p-2.5 rounded-xl">
          <IoMdCamera className="w-7 h-7" />
        </div>
        <div className="text-left">
          <p className="text-lg font-bold">เริ่มอัพโหลด</p>
          <p className="text-xs text-white/80">รับแต้มทันที</p>
        </div>
      </button>
    </div>
  </div>
))

UploadSection.displayName = 'UploadSection'
