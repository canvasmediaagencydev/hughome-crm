import { useState, useEffect, useCallback } from 'react'
import { axiosAdmin } from '@/lib/axios-admin'
import { toast } from 'sonner'
import { User, Pagination } from '@/types'

interface UseUsersParams {
  initialPage?: number
  initialRole?: string
  initialSearch?: string
}

export function useUsers(params: UseUsersParams = {}) {
  const {
    initialPage = 1,
    initialRole = 'all',
    initialSearch = ''
  } = params

  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [roleFilter, setRoleFilter] = useState(initialRole)
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [searchInput, setSearchInput] = useState(initialSearch)

  const fetchUsers = useCallback(async (page: number, role: string, search: string) => {
    try {
      setIsLoading(true)
      const response = await axiosAdmin.get('/api/admin/users', {
        params: { page, limit: 9, role, search }
      })

      setUsers(response.data.users)
      setPagination(response.data.pagination)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers(currentPage, roleFilter, searchQuery)
  }, [currentPage, roleFilter, searchQuery, fetchUsers])

  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }, [searchInput])

  const handleClearSearch = useCallback(() => {
    setSearchInput('')
    setSearchQuery('')
    setCurrentPage(1)
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleRoleFilterChange = useCallback((newRole: string) => {
    setRoleFilter(newRole)
    setCurrentPage(1)
  }, [])

  const refreshUsers = useCallback(() => {
    fetchUsers(currentPage, roleFilter, searchQuery)
  }, [currentPage, roleFilter, searchQuery, fetchUsers])

  return {
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
  }
}
