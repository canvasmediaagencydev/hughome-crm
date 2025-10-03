import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Receipt } from 'lucide-react'
import { getStatusBadge, extractStoreName } from '@/utils/receiptHelpers'

interface RecentReceiptsTableProps {
  receipts: any[]
  loading: boolean
  calculatePoints: (totalAmount: number) => number
}

export function RecentReceiptsTable({
  receipts,
  loading,
  calculatePoints
}: RecentReceiptsTableProps) {
  return (
    <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900 flex items-center justify-between">
          <div className="flex items-center">
            <Receipt className="mr-2 h-5 w-5 text-slate-400" />
            รายการใบเสร็จล่าสุด
          </div>
          <div className="flex space-x-2">
            <Link href="/admin/receipts">
              <Button
                variant="outline"
                size="sm"
                className="bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
              >
                ดูทั้งหมด
              </Button>
            </Link>
          </div>
        </CardTitle>
        <CardDescription className="text-slate-600">
          ใบเสร็จที่รอการอนุมัติ 10 รายการล่าสุด
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900 border-t-2 border-t-slate-200 mx-auto mb-2"></div>
            <p className="text-slate-500 text-sm">กำลังโหลด...</p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-8">
            <Receipt className="mx-auto h-12 w-12 text-slate-400 mb-2" />
            <p className="text-slate-500">ไม่มีใบเสร็จรอการอนุมัติ</p>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt) => {
              const user = receipt.user_profiles
              const displayName = user?.display_name || user?.first_name || 'ไม่ระบุชื่อ'
              const points = receipt.total_amount ? calculatePoints(receipt.total_amount) : 0
              const storeName = extractStoreName(receipt.ocr_data)

              return (
                <div
                  key={receipt.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-sm text-slate-900">{displayName}</span>
                      {getStatusBadge(receipt.status || 'pending')}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="font-medium">ยอดเงิน:</span> ฿
                        {receipt.total_amount?.toLocaleString() || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">วันที่ใบเสร็จ:</span>{' '}
                        {receipt.receipt_date
                          ? new Date(receipt.receipt_date).toLocaleDateString('th-TH')
                          : 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">วันที่อัปโหลด:</span>{' '}
                        {receipt.created_at
                          ? new Date(receipt.created_at).toLocaleDateString('th-TH')
                          : 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Points:</span> {points}
                      </div>
                      <div className="truncate">
                        <span className="font-medium">ร้าน:</span>
                        <span
                          className={
                            storeName === 'ไม่ใช่ของร้าน ตั้งหง่วงเซ้ง'
                              ? 'text-red-500 font-medium'
                              : ''
                          }
                        >
                          {storeName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-1 ml-2">
                    <Link href="/admin/receipts">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                      >
                        ดูรายละเอียด
                      </Button>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
