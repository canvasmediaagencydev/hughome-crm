'use client'

import { useState } from 'react'
import { FaUser } from 'react-icons/fa'
import { Pagination } from '@/components/Pagination'
import { EmptyState } from '@/components/EmptyState'
import { User } from '@/types'
import { useUsers } from '@/hooks/useUsers'
import { useUserDetails } from '@/hooks/useUserDetails'
import { useUserPoints } from '@/hooks/useUserPoints'
import { useUserRole } from '@/hooks/useUserRole'
import { UserCard } from '@/components/admin/users/UserCard'
import { SearchBar } from '@/components/admin/users/SearchBar'
import { RoleTabs } from '@/components/admin/users/RoleTabs'
import { UserDetailModal } from '@/components/admin/users/UserDetailModal'
import { EditPointsModal } from '@/components/admin/users/EditPointsModal'
import { EditRoleModal } from '@/components/admin/users/EditRoleModal'

export default function AdminUsersPage() {
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
    searchQuery,
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    handlePageChange,
    handleRoleFilterChange,
    refreshUsers
  } = useUsers()

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
    <div className="min-h-screen bg-gray-50 p-6">
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

        {/* Role Filter Tabs */}
        <RoleTabs
          activeRole={roleFilter}
          onRoleChange={handleRoleFilterChange}
        />

        {/* Users List */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">กำลังโหลด...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm">
            <EmptyState
              icon={<FaUser className="w-16 h-16 text-gray-400" />}
              title="ไม่พบข้อมูลผู้ใช้"
              className="py-16"
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onViewDetails={handleViewDetails}
                  onEditPoints={handleEditPoints}
                  onEditRole={handleEditRole}
                />
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
