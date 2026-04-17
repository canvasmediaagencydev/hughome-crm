'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { useTags } from '@/hooks/useTags'
import type { Tag } from '@/types'
import { axiosAdmin } from '@/lib/axios-admin'
import { Loader2, Search, Upload, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import type { OCRResult } from '@/types'

interface SearchUser {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  customer_code: string | null
  points_balance: number | null
  tags: Tag[]
}

export default function AdminReceiptUploadPage() {
  const { hasPermission, loading: authLoading } = useAdminAuth()
  const { data: tags = [], isLoading: loadingTags } = useTags()

  const canUpload = hasPermission(PERMISSIONS.RECEIPTS_UPLOAD)
  const canQuickApprove = hasPermission(PERMISSIONS.RECEIPTS_APPROVE)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState('all')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null)
  const [isProcessingOcr, setIsProcessingOcr] = useState(false)
  const [quickApprove, setQuickApprove] = useState(false)
  const [adminNotes, setAdminNotes] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (!selectedFile) {
      setFilePreview(null)
      return
    }

    const previewUrl = URL.createObjectURL(selectedFile)
    setFilePreview(previewUrl)

    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [selectedFile])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-500 mx-auto mb-2" />
          <p className="text-slate-600">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    )
  }

  if (!canUpload) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-2xl font-semibold text-slate-900">ไม่มีสิทธิ์เข้าถึง</p>
          <p className="text-slate-600">คุณต้องมีสิทธิ์ receipts.upload เพื่อเข้าหน้านี้</p>
          <Button asChild>
            <Link href="/admin/receipts">กลับไปหน้ารายการใบเสร็จ</Link>
          </Button>
        </div>
      </div>
    )
  }

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim() && selectedTag === 'all') {
      setSearchResults([])
      setIsDropdownOpen(false)
      return
    }

    try {
      setIsSearching(true)
      const params = new URLSearchParams()
      if (searchTerm.trim()) params.append('search', searchTerm.trim())
      if (selectedTag !== 'all') params.append('tag', selectedTag)
      params.append('limit', '20')

      const response = await axiosAdmin.get(`/api/admin/receipts/user-search?${params.toString()}`)
      setSearchResults(response.data.users || [])
      setIsDropdownOpen(true)
    } catch (error: any) {
      console.error('User search failed', error)
      toast.error(error?.response?.data?.error || 'ค้นหาผู้ใช้ไม่สำเร็จ')
    } finally {
      setIsSearching(false)
    }
  }, [searchTerm, selectedTag])

  const resetSearch = () => {
    setSearchTerm('')
    setSelectedTag('all')
    setSearchResults([])
    setIsDropdownOpen(false)
  }

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([])
      setIsDropdownOpen(false)
      return
    }

    const handler = setTimeout(() => {
      handleSearch()
    }, 400)

    return () => clearTimeout(handler)
  }, [searchTerm, selectedTag, handleSearch])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!isDropdownOpen) return
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setSelectedFile(file || null)
    setOcrResult(null)
  }

  const handleProcessOcr = async () => {
    if (!selectedFile) {
      toast.error('กรุณาเลือกรูปใบเสร็จ')
      return
    }

    try {
      setIsProcessingOcr(true)
      const formData = new FormData()
      formData.append('image', selectedFile)

      const response = await fetch('/api/receipts/ocr', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'ประมวลผล OCR ไม่สำเร็จ')
      }

      setOcrResult(result.ocrResult)
      toast.success('อ่านใบเสร็จสำเร็จ')
    } catch (error: any) {
      console.error('OCR error', error)
      toast.error(error?.message || 'ไม่สามารถอ่านใบเสร็จได้')
    } finally {
      setIsProcessingOcr(false)
    }
  }

  const handleUpload = async () => {
    if (!selectedUser) {
      toast.error('กรุณาเลือกลูกค้า')
      return
    }

    if (!selectedFile) {
      toast.error('กรุณาเลือกรูปใบเสร็จ')
      return
    }

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('image', selectedFile)
      formData.append('userId', selectedUser.id)
      formData.append('quickApprove', quickApprove ? 'true' : 'false')
      if (adminNotes.trim()) {
        formData.append('adminNotes', adminNotes.trim())
      }

      await axiosAdmin.post('/api/admin/receipts/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      toast.success(quickApprove ? 'อัปโหลดและอนุมัติใบเสร็จเรียบร้อย' : 'อัปโหลดใบเสร็จเรียบร้อย')
      setSelectedFile(null)
      setOcrResult(null)
      setAdminNotes('')
      setQuickApprove(false)
      setSearchResults([])
      setSelectedUser(null)
      setFilePreview(null)
    } catch (error: any) {
      console.error('Upload error', error)
      toast.error(error?.response?.data?.error || 'อัปโหลดใบเสร็จไม่สำเร็จ')
    } finally {
      setIsUploading(false)
    }
  }

  const getUserName = (user: SearchUser | null) => {
    if (!user) return 'ไม่ระบุ'
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
    return fullName || 'ไม่ระบุ'
  }

  const handleSelectUser = (user: SearchUser) => {
    setSelectedUser(user)
    setIsDropdownOpen(false)
  }

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">อัปโหลดใบเสร็จแทนลูกค้า</h1>
          <p className="text-slate-600">เลือกผู้ใช้จากฐานข้อมูลและส่งใบเสร็จเข้าสู่ระบบพร้อม OCR</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/receipts">กลับหน้ารายการ</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. เลือกลูกค้า</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="search">ค้นหาจากชื่อ / เบอร์โทร / Customer Code</Label>
              <div className="flex gap-2 mt-1" ref={searchContainerRef}>
                <div className="relative flex-1">
                  <Input
                    id="search"
                    placeholder="เช่น AR-10297, 50ลส-1030 หรือ 089..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0) {
                        setIsDropdownOpen(true)
                      }
                    }}
                  />
                  {isDropdownOpen && searchTerm.trim().length >= 2 && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                      {isSearching ? (
                        <div className="px-4 py-3 text-sm text-slate-500">กำลังค้นหา...</div>
                      ) : searchResults.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-500">ไม่พบลูกค้าที่ตรงกับคำค้นหา</div>
                      ) : (
                        searchResults.slice(0, 8).map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            className="w-full px-4 py-2 text-left hover:bg-slate-100 text-sm"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectUser(user)}
                          >
                            <p className="font-medium text-slate-900">{getUserName(user)}</p>
                            <p className="text-xs text-slate-500">{user.customer_code || user.phone || '-'}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="ml-2">ค้นหา</span>
                </Button>
              </div>
            </div>
            <div>
              <Label>กรองด้วย Tag</Label>
              <select
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                disabled={loadingTags}
              >
                <option value="all">แสดงทั้งหมด</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-slate-900">ผลการค้นหา</p>
                <Button variant="ghost" size="sm" onClick={resetSearch}>ล้างผลลัพธ์</Button>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className={`border rounded-lg p-3 flex items-center justify-between ${selectedUser?.id === user.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{getUserName(user)}</p>
                      <p className="text-sm text-slate-600">Customer Code: {user.customer_code || '-'}</p>
                      <p className="text-sm text-slate-600">เบอร์: {user.phone || '-'}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {user.tags?.map((tag) => (
                          <Badge key={tag.id} style={{ backgroundColor: tag.color || '#0f172a' }} className="text-white">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button variant={selectedUser?.id === user.id ? 'default' : 'outline'} onClick={() => setSelectedUser(user)}>
                      {selectedUser?.id === user.id ? <CheckCircle2 className="h-4 w-4 mr-1" /> : null}
                      {selectedUser?.id === user.id ? 'เลือกแล้ว' : 'เลือก' }
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedUser && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="font-semibold text-slate-900 mb-2">ลูกค้าที่เลือก</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-700">
                <div>
                  <p className="text-slate-500">ชื่อ-นามสกุล</p>
                  <p>{getUserName(selectedUser)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Customer Code</p>
                  <p>{selectedUser.customer_code || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">แต้มสะสม</p>
                  <p>{selectedUser.points_balance ?? 0} แต้ม</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. อัปโหลดใบเสร็จและ OCR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="receipt-file">เลือกรูปใบเสร็จ</Label>
            <Input id="receipt-file" type="file" accept="image/*" className="mt-1" onChange={handleFileChange} />
            {filePreview && (
              <img src={filePreview} alt="Receipt preview" className="mt-3 w-full max-w-sm rounded border border-slate-200" />
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={handleProcessOcr} disabled={isProcessingOcr || !selectedFile}>
              {isProcessingOcr ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="ml-2">ประมวลผล OCR</span>
            </Button>
            {ocrResult && (
              <span className="text-sm text-green-600">อ่านข้อมูลสำเร็จแล้ว</span>
            )}
          </div>

          {ocrResult && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm">
              <div>
                <p className="text-slate-500">วันที่</p>
                <p className="font-semibold text-slate-900">{ocrResult.วันที่}</p>
              </div>
              <div>
                <p className="text-slate-500">ยอดรวม</p>
                <p className="font-semibold text-slate-900">{ocrResult.ยอดรวม?.toLocaleString()} บาท</p>
              </div>
              <div>
                <p className="text-slate-500">ความถูกต้อง</p>
                <p className="font-semibold text-slate-900">{ocrResult.ความถูกต้อง}%</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border border-slate-200 rounded-lg p-3">
            <div>
              <Label className="text-slate-900">Quick Approve</Label>
              <p className="text-xs text-slate-500">อนุมัติทันทีหลังอัปโหลด (เฉพาะผู้มีสิทธิ์ receipts.approve)</p>
            </div>
            <Switch
              checked={quickApprove}
              onCheckedChange={setQuickApprove}
              disabled={!canQuickApprove}
            />
          </div>

          <div>
            <Label htmlFor="notes">หมายเหตุเพิ่มเติม (ถ้ามี)</Label>
            <Textarea
              id="notes"
              className="mt-1"
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="เช่น แอดมินยืนยันยอดกับหน้าร้านแล้ว"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="ml-2">{quickApprove ? 'อัปโหลดและอนุมัติทันที' : 'อัปโหลดใบเสร็จ'}</span>
            </Button>
            <p className="text-sm text-slate-500">ระบบจะบันทึกชื่อแอดมินผู้ส่งใบเสร็จทุกครั้ง</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
