import { User } from '@/types'
import { RoleBadge } from '@/components/StatusBadge'
import { getUserDisplayName } from '@/lib/utils'

interface EditRoleModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  newRole: 'contractor' | 'homeowner'
  setNewRole: (role: 'contractor' | 'homeowner') => void
  processingRole: boolean
  onConfirm: () => void
}

export function EditRoleModal({
  isOpen,
  onClose,
  user,
  newRole,
  setNewRole,
  processingRole,
  onConfirm
}: EditRoleModalProps) {
  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg border border-slate-200 max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-slate-900 mb-4">เปลี่ยน Role ผู้ใช้</h3>
        <p className="text-slate-600 mb-4">
          ผู้ใช้: <span className="font-semibold text-slate-900">{getUserDisplayName(user)}</span>
        </p>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-slate-600">Role ปัจจุบัน:</span>
          <RoleBadge role={user.role as 'contractor' | 'homeowner' | null} />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">
            เลือก Role ใหม่
          </label>
          <div className="space-y-2">
            <label className="flex items-center p-3 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                value="contractor"
                checked={newRole === 'contractor'}
                onChange={(e) => setNewRole(e.target.value as 'contractor' | 'homeowner')}
                className="mr-3 text-blue-600 focus:ring-blue-400"
              />
              <div>
                <div className="font-medium text-slate-900">Contractor</div>
                <div className="text-xs text-slate-500">ผู้รับเหมา/ช่าง</div>
              </div>
            </label>
            <label className="flex items-center p-3 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                value="homeowner"
                checked={newRole === 'homeowner'}
                onChange={(e) => setNewRole(e.target.value as 'contractor' | 'homeowner')}
                className="mr-3 text-blue-600 focus:ring-blue-400"
              />
              <div>
                <div className="font-medium text-slate-900">Homeowner</div>
                <div className="text-xs text-slate-500">เจ้าของบ้าน</div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={processingRole}
            className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {processingRole ? 'กำลังเปลี่ยน...' : 'ยืนยัน'}
          </button>
          <button
            onClick={onClose}
            disabled={processingRole}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 border border-slate-300 disabled:opacity-50 transition-colors"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  )
}
