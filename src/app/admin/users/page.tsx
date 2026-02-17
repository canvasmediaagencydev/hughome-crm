'use client'

import { useState } from 'react'
import { FaUser } from 'react-icons/fa'
import { Shield } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { EmptyState } from '@/components/EmptyState'
import { User } from '@/types'
import { useUsers } from '@/hooks/useUsers'
import { useTags } from '@/hooks/useTags'
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

export default function AdminUsersPage() {
  // Permission check
  const { hasPermission, loading: authLoading } = useAdminAuth()

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
  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showPointsModal, setShowPointsModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

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
    refreshUsers
  } = useUsers()

  const { data: allTags } = useTags()

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

    const success = await adjustPoints(selectedUser.id, () => {
      setShowPointsModal(false)
      refreshUsers()
    })
  }

  const confirmChangeRole = async () => {
    if (!selectedUser) return

    const success = await changeRole(selectedUser.id, () => {
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Search Bar */}
        <SearchBar
          searchInput={searchInput}
          searchQuery={searchQuery}
          onSearchInputChange={setSearchInput}
          onSearch={handleSearch}
          onClear={handleClearSearch}
          onKeyPress={handleKeyPress}
        />

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
        />

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
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <UserCard
                    user={user}
                    onViewDetails={handleViewDetails}
                    onEditPoints={canManagePoints ? handleEditPoints : undefined}
                    onEditRole={canEdit ? handleEditRole : undefined}
                  />
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
