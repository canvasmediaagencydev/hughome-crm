import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Save } from 'lucide-react'

interface PointSettingsFormProps {
  bahtPerPoint: string
  setBahtPerPoint: (value: string) => void
  loading: boolean
  saving: boolean
  onSave: () => void
  canEdit: boolean
}

export function PointSettingsForm({
  bahtPerPoint,
  setBahtPerPoint,
  loading,
  saving,
  onSave,
  canEdit
}: PointSettingsFormProps) {
  return (
    <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900 flex items-center">
          <Settings className="mr-2 h-5 w-5 text-slate-400" />
          ตั้งค่าอัตราแลกเปลี่ยน Point
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col lg:flex-row lg:items-start lg:space-x-6 space-y-4 lg:space-y-0">
        {loading ? (
          <p className="text-slate-500">กำลังโหลด...</p>
        ) : (
          <div className="flex items-end space-x-4 w-full">
            <div className="flex-1">
              <Label htmlFor="bahtPerPoint" className="text-slate-700">
                จำนวนบาทต่อ 1 Point
              </Label>
              <Input
                id="bahtPerPoint"
                type="number"
                step="0.01"
                value={bahtPerPoint}
                onChange={(e) => setBahtPerPoint(e.target.value)}
                placeholder="100.00"
                className="mt-1 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                disabled={!canEdit}
              />
              <p className="text-xs text-slate-500 mt-1">
                ตัวอย่าง: ใส่ 100 หมายถึง ใช้เงิน 100 บาท ได้ 1 Point
              </p>
              {!canEdit && (
                <p className="text-xs text-amber-600 mt-2">
                  คุณไม่มีสิทธิ์แก้ไขการตั้งค่านี้
                </p>
              )}
            </div>
          </div>
        )}

        <Button
          onClick={onSave}
          disabled={loading || saving || !canEdit}
          className="bg-slate-900 flex self-end text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
      </CardContent>
    </Card>
  )
}
