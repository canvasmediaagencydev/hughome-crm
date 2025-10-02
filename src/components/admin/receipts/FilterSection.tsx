import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'

interface FilterSectionProps {
  search: string
  status: string
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onSearch: () => void
}

export function FilterSection({
  search,
  status,
  onSearchChange,
  onStatusChange,
  onSearch
}: FilterSectionProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1">
        <Label htmlFor="search" className="text-slate-700">ค้นหา</Label>
        <div className="flex gap-2">
          <Input
            id="search"
            placeholder="ค้นหาชื่อผู้ใช้หรือยอดเงิน..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSearch()}
            className="focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          />
          <Button onClick={onSearch} variant="outline" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor="status" className="text-slate-700">สถานะ</Label>
        <select
          id="status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
        >
          <option value="pending">รอการอนุมัติ</option>
          <option value="approved">อนุมัติแล้ว</option>
          <option value="rejected">ปฏิเสธแล้ว</option>
        </select>
      </div>
    </div>
  )
}
