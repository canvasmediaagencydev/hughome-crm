'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { IoMdClose, IoMdCamera, IoMdFlashlight } from 'react-icons/io'
import { HiOutlinePhotograph } from 'react-icons/hi'

interface ReceiptCameraProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (imageFile: File) => void
}

export default function ReceiptCamera({ isOpen, onClose, onCapture }: ReceiptCameraProps) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [hasFlash, setHasFlash] = useState(false)
  const [flashEnabled, setFlashEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Start camera when component opens
  useEffect(() => {
    if (isOpen && !isPreviewMode) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [isOpen, isPreviewMode])

  // Reset states when component closes
  useEffect(() => {
    if (!isOpen) {
      setCapturedImage(null)
      setCapturedFile(null)
      setIsPreviewMode(false)
    }
  }, [isOpen])

  const startCamera = async () => {
    try {
      setError(null)

      // Request camera permissions with back camera preference for mobile
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }

      // Check if device supports flash/torch
      const videoTrack = mediaStream.getVideoTracks()[0]
      const capabilities = videoTrack.getCapabilities()
      setHasFlash('torch' in capabilities)

    } catch (err: any) {
      console.error('Error accessing camera:', err)

      if (err.name === 'NotAllowedError') {
        setError('กล้องถูกปฏิเสธ กรุณาอนุญาตการใช้งานกล้องและรีเฟรชหน้า')
      } else if (err.name === 'NotFoundError') {
        setError('ไม่พบกล้อง กรุณาตรวจสอบอุปกรณ์')
      } else {
        setError('ไม่สามารถเข้าถึงกล้องได้ กรุณาลองใหม่อีกครั้ง')
      }
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  const toggleFlash = async () => {
    if (!stream) return

    const videoTrack = stream.getVideoTracks()[0]
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: !flashEnabled } as any]
      })
      setFlashEnabled(!flashEnabled)
    } catch (err) {
      console.error('Flash control error:', err)
    }
  }

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert canvas to blob and create file
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `receipt-${Date.now()}.jpg`, {
          type: 'image/jpeg'
        })
        const imageUrl = URL.createObjectURL(blob)

        // Store captured image and file
        setCapturedImage(imageUrl)
        setCapturedFile(file)
        setIsPreviewMode(true)
      }
    }, 'image/jpeg', 0.9)
  }, [])

  const confirmCapture = useCallback(() => {
    if (capturedFile) {
      onCapture(capturedFile)
      onClose()
    }
  }, [capturedFile, onCapture, onClose])

  const retakePhoto = useCallback(() => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage)
    }
    setCapturedImage(null)
    setCapturedFile(null)
    setIsPreviewMode(false)
  }, [capturedImage])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const imageUrl = URL.createObjectURL(file)
      setCapturedImage(imageUrl)
      setCapturedFile(file)
      setIsPreviewMode(true)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4 pt-8">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/20 backdrop-blur-sm"
          >
            <IoMdClose className="w-6 h-6 text-white" />
          </button>

          <div className="text-white text-center">
            <h2 className="text-lg font-semibold">
              {isPreviewMode ? 'ตัวอย่างใบเสร็จ' : 'ถ่ายรูปใบเสร็จ'}
            </h2>
            <p className="text-sm opacity-80">
              {isPreviewMode ? 'ตรวจสอบภาพและยืนยัน' : 'จัดให้ใบเสร็จอยู่ในกรอบ'}
            </p>
          </div>

          {hasFlash && (
            <button
              onClick={toggleFlash}
              className="p-2 rounded-full bg-white/20 backdrop-blur-sm"
            >
              <IoMdFlashlight className={`w-6 h-6 ${flashEnabled ? 'text-yellow-400' : 'text-white'}`} />
            </button>
          )}
        </div>
      </div>

      {/* Camera View or Preview */}
      <div className="relative w-full h-full flex items-center justify-center">
        {isPreviewMode && capturedImage ? (
          /* Preview Mode */
          <div className="relative w-full h-full">
            <img
              src={capturedImage}
              alt="Captured receipt"
              className="w-full h-full object-cover"
            />
            {/* Preview overlay */}
            <div className="absolute inset-0 bg-black/20" />
          </div>
        ) : error ? (
          <div className="text-white text-center p-8">
            <p className="mb-4">{error}</p>
            <button
              onClick={startCamera}
              className="bg-red-500 text-white px-6 py-2 rounded-lg"
            >
              ลองอีกครั้ง
            </button>
          </div>
        ) : (
          <>
            {/* Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Receipt Frame Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Dark overlay with transparent center */}
              <div className="absolute inset-0 bg-black/40" />

              {/* Receipt Frame */}
              <div className="relative">
                {/* Main frame */}
                <div className="w-90 h-125 border-2 border-white rounded-lg bg-transparent relative">
                  {/* Corner indicators */}
                  <div className="absolute -top-2 -left-2 w-6 h-6 border-l-4 border-t-4 border-red-500 rounded-tl-lg" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 border-r-4 border-t-4 border-red-500 rounded-tr-lg" />
                  <div className="absolute -bottom-2 -left-2 w-6 h-6 border-l-4 border-b-4 border-red-500 rounded-bl-lg" />
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 border-r-4 border-b-4 border-red-500 rounded-br-lg" />

                  {/* Center crosshair */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-0.5 bg-white/60" />
                    <div className="absolute w-0.5 h-8 bg-white/60" />
                  </div>
                </div>

                {/* Helper text */}

              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/60 to-transparent p-6 pb-8">
        {isPreviewMode ? (
          /* Preview Controls */
          <div className="flex items-center justify-center space-x-6">
            <button
              onClick={retakePhoto}
              className="flex items-center space-x-2 bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-full font-medium"
            >
              <IoMdCamera className="w-5 h-5" />
              <span>ถ่ายใหม่</span>
            </button>

            <button
              onClick={confirmCapture}
              className="flex items-center space-x-2 bg-green-500 text-white px-8 py-3 rounded-full font-medium shadow-lg"
            >
              <span>✓</span>
              <span>ใช้รูปนี้</span>
            </button>
          </div>
        ) : (
          /* Camera Controls */
          <div className="flex items-center justify-center space-x-8">
            {/* Gallery Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-4 rounded-full bg-white/20 backdrop-blur-sm"
            >
              <HiOutlinePhotograph className="w-8 h-8 text-white" />
            </button>

            {/* Capture Button */}
            <button
              onClick={capturePhoto}
              disabled={!!error}
              className="relative p-2 rounded-full bg-white border-3 border-gray-300 disabled:opacity-50"
            >
              <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center">
                <IoMdCamera className="w-6 h-6 text-white" />
              </div>
            </button>

            {/* Placeholder for symmetry */}
            <div className="p-4 rounded-full opacity-0">
              <HiOutlinePhotograph className="w-8 h-8" />
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}