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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800 flex items-center justify-between">
            <div className="flex items-center">
              <Zap className="mr-2 h-5 w-5" />
              อนุมัติอัตโนมัติ
            </div>
          </CardTitle>
          <CardDescription>
            อนุมัติใบเสร็จที่เป็นของร้าน "ตั้งหง่วงเซ้ง" ทั้งหมดในครั้งเดียว
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={onAutoApprove}
            disabled={autoApproving || loading || autoRejecting}
            className="bg-green-600 hover:bg-green-700"
          >
            <Zap className="mr-2 h-4 w-4" />
            {autoApproving ? 'กำลังอนุมัติ...' : 'อนุมัติใบเสร็จของร้านทั้งหมด'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800 flex items-center justify-between">
            <div className="flex items-center">
              <X className="mr-2 h-5 w-5" />
              ปฏิเสธอัตโนมัติ
            </div>
          </CardTitle>
          <CardDescription>
            ปฏิเสธใบเสร็จที่ไม่ใช่ของร้าน "ตั้งหง่วงเซ้ง" ทั้งหมดในครั้งเดียว
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={onAutoReject}
            disabled={autoRejecting || loading || autoApproving}
            className="bg-red-600 hover:bg-red-700"
          >
            <X className="mr-2 h-4 w-4" />
            {autoRejecting ? 'กำลังปฏิเสธ...' : 'ปฏิเสธใบเสร็จที่ไม่ใช่ของร้านทั้งหมด'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
