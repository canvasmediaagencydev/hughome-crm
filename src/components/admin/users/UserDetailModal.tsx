import { User, UserDetails } from '@/types'
import { Pagination } from '@/components/Pagination'
import { RoleBadge } from '@/components/StatusBadge'
import {
  formatDate,
  formatPoints,
  getUserDisplayName,
  getAvatarUrl,
  getTransactionTypeLabel,
  getTransactionColor,
  getRedemptionStatusLabel,
  getRedemptionStatusColor
} from '@/lib/utils'
import { useUserNotes } from '@/hooks/useUserNotes'
import { useEffect } from 'react'

interface UserDetailModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  userDetails: UserDetails | null
  loadingDetails: boolean
  onTransactionPageChange: (page: number) => void
  onRedemptionPageChange: (page: number) => void
}

export function UserDetailModal({
  isOpen,
  onClose,
  user,
  userDetails,
  loadingDetails,
  onTransactionPageChange,
  onRedemptionPageChange
}: UserDetailModalProps) {
  const {
    notes,
    pagination: notesPagination,
    loadingNotes,
    submittingNote,
    newNoteContent,
    setNewNoteContent,
    editingNoteId,
    editNoteContent,
    setEditNoteContent,
    fetchNotes,
    addNote,
    updateNote,
    deleteNote,
    startEditing,
    cancelEditing,
    handlePageChange: handleNotesPageChange,
  } = useUserNotes()

  useEffect(() => {
    if (isOpen && user) {
      fetchNotes(user.id)
    }
  }, [isOpen, user?.id])

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={getAvatarUrl(user.picture_url, getUserDisplayName(user))}
              alt={getUserDisplayName(user)}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-200"
            />
            <div>
              <h2 className="text-xl font-bold text-slate-900">{getUserDisplayName(user)}</h2>
              <div className="mt-1">
                <RoleBadge role={user.role as 'contractor' | 'homeowner' | null} />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loadingDetails ? (
            <div className="text-center py-12">
              <div className="relative inline-flex">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-900 border-t-transparent absolute top-0 left-0"></div>
              </div>
              <p className="text-slate-600 mt-4 font-medium">กำลังโหลด...</p>
            </div>
          ) : userDetails && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-4">ข้อมูลผู้ใช้</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-600">เบอร์โทร</span>
                    <span className="text-sm font-medium text-slate-900">{user.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-600">แต้มคงเหลือ</span>
                    <span className="text-sm font-bold text-blue-600">{formatPoints(user.points_balance || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-600">สมัครเมื่อ</span>
                    <span className="text-sm font-medium text-slate-900">{formatDate(user.created_at)}</span>
                  </div>
                  {user.last_login_at && (
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-sm text-slate-600">Login ล่าสุด</span>
                      <span className="text-sm font-medium text-slate-900">{formatDate(user.last_login_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction History */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-4">ประวัติธุรกรรม</h3>
                {userDetails.transactionPagination.total === 0 ? (
                  <p className="text-center text-slate-500 py-8">ไม่มีประวัติธุรกรรม</p>
                ) : (
                  <div className="space-y-3">
                    {userDetails.transactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 text-sm">{getTransactionTypeLabel(transaction.transaction_type)}</div>
                          {transaction.description && (
                            <div className="text-xs text-slate-600 mt-1">{transaction.description}</div>
                          )}
                          <div className="text-xs text-slate-500 mt-1">{formatDate(transaction.created_at, { includeTime: true })}</div>
                        </div>
                        <div className={`text-lg font-bold ml-4 ${getTransactionColor(transaction.transaction_type)}`}>
                          {transaction.points > 0 ? '+' : ''}{transaction.points}
                        </div>
                      </div>
                    ))}

                    {userDetails.transactionPagination.totalPages > 1 && (
                      <div className="pt-4 mt-4 border-t border-slate-200">
                        <Pagination
                          currentPage={userDetails.transactionPagination.page}
                          totalPages={userDetails.transactionPagination.totalPages}
                          onPageChange={onTransactionPageChange}
                          disabled={loadingDetails}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Redemption History */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-4">ประวัติการแลกรางวัล</h3>
                {userDetails.redemptionPagination.total === 0 ? (
                  <p className="text-center text-slate-500 py-8">ไม่มีประวัติการแลกรางวัล</p>
                ) : (
                  <div className="space-y-3">
                    {userDetails.redemptions.map((redemption) => (
                      <div key={redemption.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                        {redemption.rewards.image_url && (
                          <img
                            src={redemption.rewards.image_url}
                            alt={redemption.rewards.name}
                            className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900">{redemption.rewards.name}</div>
                          <div className="text-sm text-blue-600 font-semibold mt-1">{formatPoints(redemption.points_used)} แต้ม</div>
                          <div className="text-xs text-slate-500 mt-1">{formatDate(redemption.created_at, { includeTime: true })}</div>
                          {redemption.tracking_number && (
                            <div className="text-xs text-slate-600 mt-1">
                              Tracking: {redemption.tracking_number}
                            </div>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getRedemptionStatusColor(redemption.status)}`}>
                          {getRedemptionStatusLabel(redemption.status)}
                        </span>
                      </div>
                    ))}

                    {userDetails.redemptionPagination.totalPages > 1 && (
                      <div className="pt-4 mt-4 border-t border-slate-200">
                        <Pagination
                          currentPage={userDetails.redemptionPagination.page}
                          totalPages={userDetails.redemptionPagination.totalPages}
                          onPageChange={onRedemptionPageChange}
                          disabled={loadingDetails}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Admin Notes */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-4">บันทึกจากแอดมิน</h3>

                {/* Add Note Form */}
                <div className="mb-4">
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="เขียนบันทึกเกี่ยวกับผู้ใช้คนนี้..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                    disabled={submittingNote}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => addNote(user.id)}
                      disabled={submittingNote || !newNoteContent.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingNote ? 'กำลังบันทึก...' : 'เพิ่มบันทึก'}
                    </button>
                  </div>
                </div>

                {/* Notes List */}
                {loadingNotes ? (
                  <div className="text-center py-8">
                    <div className="relative inline-flex">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200"></div>
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-900 border-t-transparent absolute top-0 left-0"></div>
                    </div>
                  </div>
                ) : notes.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">ยังไม่มีบันทึก</p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={note.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        {editingNoteId === note.id ? (
                          <div>
                            <textarea
                              value={editNoteContent}
                              onChange={(e) => setEditNoteContent(e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              rows={3}
                              disabled={submittingNote}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button
                                onClick={cancelEditing}
                                disabled={submittingNote}
                                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
                              >
                                ยกเลิก
                              </button>
                              <button
                                onClick={() => updateNote(user.id, note.id)}
                                disabled={submittingNote || !editNoteContent.trim()}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {submittingNote ? 'กำลังบันทึก...' : 'บันทึก'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <img
                                  src={getAvatarUrl(note.user_profiles?.picture_url, note.user_profiles?.display_name || 'System Admin')}
                                  alt={note.user_profiles?.display_name || 'System Admin'}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                                <div>
                                  <div className="text-sm font-medium text-slate-900">
                                    {note.user_profiles?.display_name || 'System Admin'}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {formatDate(note.created_at, { includeTime: true })}
                                    {note.updated_at && note.updated_at !== note.created_at && (
                                      <span className="ml-1">(แก้ไขแล้ว)</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => startEditing(note)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                                  title="แก้ไข"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => deleteNote(user.id, note.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                  title="ลบ"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.note_content}</p>
                          </div>
                        )}
                      </div>
                    ))}

                    {notesPagination.totalPages > 1 && (
                      <div className="pt-4 mt-4 border-t border-slate-200">
                        <Pagination
                          currentPage={notesPagination.page}
                          totalPages={notesPagination.totalPages}
                          onPageChange={(page) => handleNotesPageChange(user.id, page)}
                          disabled={loadingNotes}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}
