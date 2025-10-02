import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Zap, X } from 'lucide-react'

interface AutoActionCardsProps {
  autoApproving: boolean
  autoRejecting: boolean
  loading: boolean
  onAutoApprove: () => void
  onAutoReject: () => void
}

export function AutoActionCards({
  autoApproving,
  autoRejecting,
  loading,
  onAutoApprove,
  onAutoReject
}: AutoActionCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center text-slate-900 font-semibold mb-1">
              <Zap className="mr-2 h-5 w-5 text-blue-400" />
              อนุมัติอัตโนมัติ
            </div>
            <p className="text-sm text-slate-600">
              อนุมัติใบเสร็จที่เป็นของร้าน "ตั้งหง่วงเซ้ง" ทั้งหมดในครั้งเดียว
            </p>
          </div>
        </div>
        <Button
          onClick={onAutoApprove}
          disabled={autoApproving || loading || autoRejecting}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white"
        >
          <Zap className="mr-2 h-4 w-4" />
          {autoApproving ? 'กำลังอนุมัติ...' : 'อนุมัติใบเสร็จของร้าน'}
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center text-slate-900 font-semibold mb-1">
              <X className="mr-2 h-5 w-5 text-slate-400" />
              ปฏิเสธอัตโนมัติ
            </div>
            <p className="text-sm text-slate-600">
              ปฏิเสธใบเสร็จที่ไม่ใช่ของร้าน "ตั้งหง่วงเซ้ง" ทั้งหมดในครั้งเดียว
            </p>
          </div>
        </div>
        <Button
          onClick={onAutoReject}
          disabled={autoRejecting || loading || autoApproving}
          className="w-full bg-red-600 hover:bg-red-700 text-white"
        >
          <X className="mr-2 h-4 w-4" />
          {autoRejecting ? 'กำลังปฏิเสธ...' : 'ปฏิเสธใบเสร็จที่ไม่ใช่ของร้าน'}
        </Button>
      </div>
    </div>
  )
}
