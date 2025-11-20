import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'
import { User, Pagination } from '@/types'
import debounce from 'lodash.debounce'

interface UseUsersParams {
  initialPage?: number
  initialRole?: string
  initialSearch?: string
}

async function fetchUsers(page: number, role: string, search: string) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '9',
    role,
  })

  if (search.trim()) {
    params.append('search', search.trim())
  }

  const response = await axiosAdmin.get(`/api/admin/users?${params}`)
  return response.data
}

export function useUsers(params: UseUsersParams = {}) {
  const {
    initialPage = 1,
    initialRole = 'all',
    initialSearch = ''
  } = params

  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [roleFilter, setRoleFilter] = useState(initialRole)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)

  // Debounce search (300ms)
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => {
      setDebouncedSearch(value)
      setCurrentPage(1)
    }, 300),
    []
  )

  // Update debounced search when input changes
  useMemo(() => {
    debouncedSetSearch(searchInput)
  }, [searchInput, debouncedSetSearch])

  // Main users query with React Query
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['users', currentPage, roleFilter, debouncedSearch],
    queryFn: () => fetchUsers(currentPage, roleFilter, debouncedSearch),
    staleTime: 2 * 60 * 1000, // 2 minutes - user data relatively stable
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true,
    retry: 1,
  })

  const users = data?.users || []
  const pagination: Pagination | null = data?.pagination || null

  // Handle errors
  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล'
    if (errorMessage.includes('Unauthorized')) {
      toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
    } else if (errorMessage.includes('Forbidden')) {
      toast.error('คุณไม่มีสิทธิ์ดูข้อมูลผู้ใช้')
    } else {
      toast.error(errorMessage)
    }
  }

  // Prefetch next page for better UX
  if (pagination && currentPage < pagination.totalPages) {
    queryClient.prefetchQuery({
      queryKey: ['users', currentPage + 1, roleFilter, debouncedSearch],
      queryFn: () => fetchUsers(currentPage + 1, roleFilter, debouncedSearch),
      staleTime: 2 * 60 * 1000,
    })
  }

  const handleSearch = useCallback(() => {
    setDebouncedSearch(searchInput)
    setCurrentPage(1)
  }, [searchInput])

  const handleClearSearch = useCallback(() => {
    setSearchInput('')
    setDebouncedSearch('')
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
    refetch()
  }, [refetch])

  return {
    users,
    isLoading,
    pagination,
    currentPage,
    roleFilter,
    searchQuery: debouncedSearch, // For backward compatibility
    searchInput,
    setSearchInput,
    handleSearch,
    handleClearSearch,
    handlePageChange,
    handleRoleFilterChange,
    refreshUsers
  }
}
