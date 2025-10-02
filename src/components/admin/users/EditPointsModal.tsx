import { User } from '@/types'
import { formatPoints, getUserDisplayName } from '@/lib/utils'

interface EditPointsModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  pointsAmount: string
  setPointsAmount: (amount: string) => void
  pointsReason: string
  setPointsReason: (reason: string) => void
  pointsAction: 'add' | 'deduct'
  setPointsAction: (action: 'add' | 'deduct') => void
  processingPoints: boolean
  onConfirm: () => void
}

export function EditPointsModal({
  isOpen,
  onClose,
  user,
  pointsAmount,
  setPointsAmount,
  pointsReason,
  setPointsReason,
  pointsAction,
  setPointsAction,
  processingPoints,
  onConfirm
}: EditPointsModalProps) {
  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">ปรับแต้มผู้ใช้</h3>
        <p className="text-gray-600 mb-4">
          ผู้ใช้: <span className="font-semibold">{getUserDisplayName(user)}</span>
        </p>
        <p className="text-gray-600 mb-4">
          แต้มปัจจุบัน: <span className="font-semibold text-red-600">{formatPoints(user.points_balance || 0)}</span>
        </p>

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ประเภทการปรับแต้ม
            </label>
            <div className="space-y-2">
              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                pointsAction === 'add'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  value="add"
                  checked={pointsAction === 'add'}
                  onChange={(e) => setPointsAction(e.target.value as 'add' | 'deduct')}
                  className="mr-3 w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <div>
                  <div className="font-medium text-gray-900">เพิ่มแต้ม</div>
                  <div className="text-sm text-gray-600">เพิ่มแต้มให้ผู้ใช้ (โบนัส/คืนเงิน)</div>
                </div>
              </label>
              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                pointsAction === 'deduct'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  value="deduct"
                  checked={pointsAction === 'deduct'}
                  onChange={(e) => setPointsAction(e.target.value as 'add' | 'deduct')}
                  className="mr-3 w-4 h-4 text-red-600 focus:ring-red-500"
                />
                <div>
                  <div className="font-medium text-gray-900">ลดแต้ม</div>
                  <div className="text-sm text-gray-600">หักแต้มจากผู้ใช้</div>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              จำนวนแต้ม (ตัวเลขบวกเท่านั้น)
            </label>
            <input
              type="number"
              value={pointsAmount}
              onChange={(e) => setPointsAmount(e.target.value)}
              placeholder="0"
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              เหตุผล
            </label>
            <textarea
              value={pointsReason}
              onChange={(e) => setPointsReason(e.target.value)}
              placeholder="ระบุเหตุผลในการปรับแต้ม..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={processingPoints}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {processingPoints ? 'กำลังปรับแต้ม...' : 'ยืนยัน'}
          </button>
          <button
            onClick={onClose}
            disabled={processingPoints}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  )
}
