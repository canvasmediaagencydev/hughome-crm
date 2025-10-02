import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { OCRResult } from '@/types'
import { UserSessionManager } from '@/lib/user-session'

export function useReceiptUpload() {
  const [isUploadResultOpen, setIsUploadResultOpen] = useState(false)
  const [isUploadLoading, setIsUploadLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [capturedImageFile, setCapturedImageFile] = useState<File | null>(null)

  const processOCR = useCallback(async (imageFile: File) => {
    try {
      setIsUploadLoading(true)
      setUploadError(null)
      setIsUploadResultOpen(true)
      setCapturedImageFile(imageFile)

      // Prepare form data for OCR only
      const formData = new FormData()
      formData.append('image', imageFile)

      console.log('Processing OCR...', imageFile.name)

      // Process OCR only (no database upload)
      const response = await fetch('/api/receipts/ocr', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'การประมวลผล OCR ล้มเหลว')
      }

      if (result.success && result.ocrResult) {
        console.log('OCR processing successful:', result)
        setOcrResult(result.ocrResult)
      } else {
        throw new Error('ไม่ได้รับข้อมูลผลลัพธ์จากเซิร์ฟเวอร์')
      }

    } catch (error) {
      console.error('OCR processing error:', error)
      setUploadError(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการประมวลผลใบเสร็จ')
    } finally {
      setIsUploadLoading(false)
    }
  }, [])

  const uploadToDatabase = useCallback(async () => {
    if (!capturedImageFile || !ocrResult) {
      toast.error('ไม่พบข้อมูลรูปภาพหรือผลการอ่าน OCR')
      return
    }

    try {
      // Get user ID from session
      const cachedSession = UserSessionManager.getCachedSession()
      if (!cachedSession?.user?.id) {
        throw new Error('ไม่พบข้อมูล user session')
      }

      // Close modal immediately and show success toast
      setIsUploadResultOpen(false)
      setOcrResult(null)
      setUploadError(null)
      setCapturedImageFile(null)

      // Show immediate success toast
      toast.success('ส่งใบเสร็จสำเร็จแล้ว! รอการอนุมัติจากแอดมิน')

      // Upload to database in background (no loading state)
      const formData = new FormData()
      formData.append('image', capturedImageFile)
      formData.append('userId', cachedSession.user.id)

      console.log('Uploading receipt to database...', capturedImageFile.name)

      // Upload to database (background process)
      const response = await fetch('/api/receipts/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        // Handle errors silently or show subtle notification
        console.error('Upload error:', result.error)
        if (response.status === 409) {
          // Duplicate error - show warning toast
          toast.warning('พบใบเสร็จซ้ำ กรุณาตรวจสอบใบเสร็จที่อัปโหลดแล้ว')
        } else {
          toast.error('เกิดข้อผิดพลาดในการอัปโหลดใบเสร็จ')
        }
        return
      }

      if (result.success) {
        console.log('Database upload successful:', result)
      } else {
        console.error('Upload failed:', result)
        toast.error('ไม่สามารถบันทึกข้อมูลได้')
      }

    } catch (error) {
      console.error('Database upload error:', error)
      toast.error('เกิดข้อผิดพลาดในการส่งใบเสร็จ')
    }
  }, [capturedImageFile, ocrResult])

  const handleRetake = useCallback(() => {
    // Close result modal
    setIsUploadResultOpen(false)
    setOcrResult(null)
    setUploadError(null)
    setCapturedImageFile(null)
  }, [])

  const handleClose = useCallback(() => {
    setIsUploadResultOpen(false)
    setOcrResult(null)
    setUploadError(null)
    setCapturedImageFile(null)
  }, [])

  return {
    isUploadResultOpen,
    isUploadLoading,
    ocrResult,
    uploadError,
    processOCR,
    uploadToDatabase,
    handleRetake,
    handleClose
  }
}
