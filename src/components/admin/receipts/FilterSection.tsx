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
        <Label htmlFor="search">ค้นหา</Label>
        <div className="flex gap-2">
          <Input
            id="search"
            placeholder="ค้นหาชื่อผู้ใช้หรือยอดเงิน..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSearch()}
          />
          <Button onClick={onSearch} variant="outline">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <Label htmlFor="status">สถานะ</Label>
        <select
          id="status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
        >
          <option value="pending">รอการอนุมัติ</option>
          <option value="approved">อนุมัติแล้ว</option>
          <option value="rejected">ปฏิเสธแล้ว</option>
          <option value="processing">กำลังประมวลผล</option>
        </select>
      </div>
    </div>
  )
}
