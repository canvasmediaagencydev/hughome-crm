import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Receipt, Gift } from 'lucide-react'

export function QuickActions() {
  return (
    <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900">การดำเนินการด่วน</CardTitle>
        <CardDescription className="text-slate-600">
          ฟีเจอร์ที่ใช้บ่อยสำหรับการจัดการระบบ
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/users">
          <Button
            variant="outline"
            className="w-full bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
          >
            <Users className="mr-2 h-4 w-4" />
            ดูผู้ใช้ทั้งหมด
          </Button>
        </Link>
        <Link href="/admin/receipts">
          <Button
            variant="outline"
            className="w-full bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
          >
            <Receipt className="mr-2 h-4 w-4" />
            ใบเสร็จรอการอนุมัติ
          </Button>
        </Link>
        <Link href="/admin/rewards">
          <Button
            variant="outline"
            className="w-full bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
          >
            <Gift className="mr-2 h-4 w-4" />
            เพิ่มรางวัลใหม่
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
