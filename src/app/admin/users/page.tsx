'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FaUser } from 'react-icons/fa'
import { Shield, ChevronDown, ChevronUp, CheckSquare, Square, X, Tag as TagIcon } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { EmptyState } from '@/components/EmptyState'
import { User } from '@/types'
import { useUsers } from '@/hooks/useUsers'
import { useTags } from '@/hooks/useTags'
import { useBulkTagAssignment } from '@/hooks/useBulkTagAssignment'
import { TagBadge } from '@/components/TagBadge'
import { useUserDetails } from '@/hooks/useUserDetails'
import { useUserPoints } from '@/hooks/useUserPoints'
import { useUserRole } from '@/hooks/useUserRole'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { UserCard } from '@/components/admin/users/UserCard'
import { SearchBar } from '@/components/admin/users/SearchBar'
import { RoleTabs } from '@/components/admin/users/RoleTabs'
import { UserDetailModal } from '@/components/admin/users/UserDetailModal'
import { EditPointsModal } from '@/components/admin/users/EditPointsModal'
import { EditRoleModal } from '@/components/admin/users/EditRoleModal'

function AdminUsersContent() {
  // Permission check
  const { hasPermission, loading: authLoading } = useAdminAuth()
  const searchParams = useSearchParams()
  const tagFromUrl = searchParams.get('tag') || ''

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 border-t-2 border-t-slate-200 mx-auto mb-2"></div>
          <p className="text-slate-500">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    )
  }

  if (!hasPermission(PERMISSIONS.USERS_VIEW)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-slate-600">คุณไม่มีสิทธิ์ในการดูข้อมูลผู้ใช้</p>
        </div>
      </div>
    )
  }

  const canEdit = hasPermission(PERMISSIONS.USERS_EDIT)
  const canManagePoints = hasPermission(PERMISSIONS.USERS_MANAGE_POINTS)
  const canManageTags = hasPermission(PERMISSIONS.USERS_MANAGE_TAGS)

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showPointsModal, setShowPointsModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  // Advanced filters UI state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Bulk tag dropdown state
  const [bulkTagId, setBulkTagId] = useState('')

  // Custom hooks
  const {
    users,
    isLoading,
    pagination,
    currentPage,
    roleFilter,
    tagFilter,
    searchQuery,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    handlePageChange,
    handleRoleFilterChange,
    handleTagFilterChange,
    refreshUsers,
    pointsMin,
    setPointsMin,
    pointsMax,
    setPointsMax,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    hasActiveFilters,
    handleClearFilters,
  } = useUsers({ initialTagFilter: tagFromUrl })

  const { data: allTags } = useTags()

  const {
    selectedUserIds,
    toggleUser,
    selectAll,
    clearSelection,
    isSelectionMode,
    enterSelectionMode,
    exitSelectionMode,
    assignTag,
    isAssigning,
  } = useBulkTagAssignment()

  const {
    userDetails,
    loadingDetails,
    fetchUserDetails,
    handleTransactionPageChange,
    handleRedemptionPageChange,
    clearUserDetails
  } = useUserDetails()

  const {
    pointsAmount,
    setPointsAmount,
    pointsReason,
    setPointsReason,
    pointsAction,
    setPointsAction,
    processingPoints,
    adjustPoints,
    resetPointsForm
  } = useUserPoints()

  const {
    newRole,
    setNewRole,
    processingRole,
    changeRole
  } = useUserRole()

  // Event handlers
  const handleViewDetails = async (user: User) => {
    setSelectedUser(user)
    setShowDetailModal(true)
    await fetchUserDetails(user.id, 1, 1)
  }

  const handleEditPoints = (user: User) => {
    setSelectedUser(user)
    resetPointsForm()
    setShowPointsModal(true)
  }

  const handleEditRole = (user: User) => {
    setSelectedUser(user)
    setNewRole((user.role as 'contractor' | 'homeowner') || 'contractor')
    setShowRoleModal(true)
  }

  const confirmAdjustPoints = async () => {
    if (!selectedUser) return
    await adjustPoints(selectedUser.id, () => {
      setShowPointsModal(false)
      refreshUsers()
    })
  }

  const confirmChangeRole = async () => {
    if (!selectedUser) return
    await changeRole(selectedUser.id, () => {
      setShowRoleModal(false)
      refreshUsers()
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleTransactionPaginationChange = async (newPage: number) => {
    if (selectedUser && userDetails) {
      await handleTransactionPageChange(
        selectedUser.id,
        newPage,
        userDetails.redemptionPagination.page
      )
    }
  }

  const handleRedemptionPaginationChange = async (newPage: number) => {
    if (selectedUser && userDetails) {
      await handleRedemptionPageChange(
        selectedUser.id,
        userDetails.transactionPagination.page,
        newPage
      )
    }
  }

  const handleBulkAssign = async (action: 'add' | 'remove') => {
    if (!bulkTagId || selectedUserIds.size === 0) return
    await assignTag(bulkTagId, action)
    setBulkTagId('')
  }

  const currentUserIds = users.map((u: User) => u.id)
  const allCurrentSelected = currentUserIds.length > 0 && currentUserIds.every((id: string) => selectedUserIds.has(id))

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-2">
          <SearchBar
            searchInput={searchInput}
            searchQuery={searchQuery}
            onSearchInputChange={setSearchInput}
            onSearch={handleSearch}
            onClear={handleClearSearch}
            onKeyPress={handleKeyPress}
          />
        </div>

        {/* Advanced Filters */}
        <div className="mb-4">
          <button
            onClick={() => setShowAdvancedFilters((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            {showAdvancedFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            ตัวกรองขั้นสูง
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                กำลังใช้งาน
              </span>
            )}
          </button>

          {showAdvancedFilters && (
            <div className="mt-3 p-4 bg-white rounded-lg border border-slate-200 shadow-sm space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">คะแนน (ขั้นต่ำ)</label>
                  <input
                    type="number"
                    min="0"
                    value={pointsMin}
                    onChange={(e) => { setPointsMin(e.target.value); }}
                    placeholder="เช่น 100"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">คะแนน (สูงสุด)</label>
                  <input
                    type="number"
                    min="0"
                    value={pointsMax}
                    onChange={(e) => { setPointsMax(e.target.value); }}
                    placeholder="เช่น 500"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">วันสมัคร (ตั้งแต่)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">วันสมัคร (ถึง)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  />
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tag Filter */}
        {allTags && allTags.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-sm text-slate-500 font-medium">Tag:</span>
            <button
              onClick={() => handleTagFilterChange('')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !tagFilter
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด
            </button>
            {allTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleTagFilterChange(tagFilter === tag.id ? '' : tag.id)}
                className={`rounded-full transition-all ${
                  tagFilter === tag.id ? 'ring-2 ring-offset-1 ring-slate-900' : ''
                }`}
              >
                <TagBadge tag={tag} size="sm" />
              </button>
            ))}
          </div>
        )}

        {/* Role Filter Tabs */}
        <RoleTabs
          activeRole={roleFilter}
          onRoleChange={handleRoleFilterChange}
          isSelectionMode={isSelectionMode}
          onEnterSelection={canManageTags ? enterSelectionMode : undefined}
          onExitSelection={canManageTags ? exitSelectionMode : undefined}
        />

        {/* Select All (in selection mode) */}
        {isSelectionMode && users.length > 0 && (
          <div className="flex items-center gap-3 mb-3 px-1">
            <button
              onClick={() => allCurrentSelected ? clearSelection() : selectAll(currentUserIds)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              {allCurrentSelected ? (
                <CheckSquare className="w-4 h-4 text-slate-900" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              เลือกทั้งหมดในหน้านี้ ({currentUserIds.length} คน)
            </button>
            {selectedUserIds.size > 0 && (
              <span className="text-sm text-blue-600 font-medium">
                เลือกแล้ว {selectedUserIds.size} คน
              </span>
            )}
          </div>
        )}

        {/* Users List */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="relative inline-flex">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-900 border-t-transparent absolute top-0 left-0"></div>
            </div>
            <p className="text-slate-600 mt-6 font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <EmptyState
              icon={<FaUser className="w-16 h-16 text-slate-400" />}
              title="ไม่พบข้อมูลผู้ใช้"
              className="py-20"
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {users.map((user: User, index: number) => (
                <div
                  key={user.id}
                  className={`animate-fade-in relative ${isSelectionMode ? 'cursor-pointer' : ''}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={isSelectionMode ? () => toggleUser(user.id) : undefined}
                >
                  {isSelectionMode && (
                    <div className="absolute top-3 right-3 z-10 pointer-events-none">
                      {selectedUserIds.has(user.id) ? (
                        <div className="w-5 h-5 rounded bg-slate-900 flex items-center justify-center shadow-sm">
                          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded bg-white border-2 border-slate-300 shadow-sm" />
                      )}
                    </div>
                  )}
                  <div className={isSelectionMode ? `${selectedUserIds.has(user.id) ? 'ring-2 ring-slate-900 ring-offset-1' : 'ring-1 ring-slate-200'} rounded-lg` : ''}>
                    <UserCard
                      user={user}
                      onViewDetails={isSelectionMode ? () => {} : handleViewDetails}
                      onEditPoints={!isSelectionMode && canManagePoints ? handleEditPoints : undefined}
                      onEditRole={!isSelectionMode && canEdit ? handleEditRole : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      {/* Bulk Action Bar */}
      {isSelectionMode && selectedUserIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-40 p-4">
          <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-slate-700">
              เลือกแล้ว {selectedUserIds.size} คน
            </span>
            <div className="flex items-center gap-2 flex-1">
              <TagIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <select
                value={bulkTagId}
                onChange={(e) => setBulkTagId(e.target.value)}
                className="flex-1 max-w-xs px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              >
                <option value="">เลือก Tag...</option>
                {allTags?.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleBulkAssign('add')}
                disabled={!bulkTagId || isAssigning}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAssigning ? 'กำลังดำเนินการ...' : 'เพิ่ม Tag'}
              </button>
              <button
                onClick={() => handleBulkAssign('remove')}
                disabled={!bulkTagId || isAssigning}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ลบ Tag
              </button>
            </div>
            <button
              onClick={clearSelection}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              title="ล้างการเลือก"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <UserDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          clearUserDetails()
        }}
        user={selectedUser}
        userDetails={userDetails}
        loadingDetails={loadingDetails}
        onTransactionPageChange={handleTransactionPaginationChange}
        onRedemptionPageChange={handleRedemptionPaginationChange}
      />

      <EditPointsModal
        isOpen={showPointsModal}
        onClose={() => setShowPointsModal(false)}
        user={selectedUser}
        pointsAmount={pointsAmount}
        setPointsAmount={setPointsAmount}
        pointsReason={pointsReason}
        setPointsReason={setPointsReason}
        pointsAction={pointsAction}
        setPointsAction={setPointsAction}
        processingPoints={processingPoints}
        onConfirm={confirmAdjustPoints}
      />

      <EditRoleModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        user={selectedUser}
        newRole={newRole}
        setNewRole={setNewRole}
        processingRole={processingRole}
        onConfirm={confirmChangeRole}
      />
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 border-t-2 border-t-slate-200"></div>
      </div>
    }>
      <AdminUsersContent />
    </Suspense>
  )
}
