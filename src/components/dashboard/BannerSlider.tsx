import { useState, useCallback, useEffect, useRef, memo } from 'react'
import Image from 'next/image'

export const BannerSlider = memo(() => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const slideInterval = useRef<NodeJS.Timeout | null>(null)

  // Mock multiple banners - ในอนาคตจะ fetch จาก API
  const banners = [
    '/image/banner.svg',
    '/image/banner.svg', // ใช้ไฟล์เดียวก่อน
    '/image/banner.svg',
  ]

  const startSlideShow = useCallback(() => {
    slideInterval.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length)
    }, 4000) // เปลี่ยนทุก 4 วินาที
  }, [banners.length])

  const stopSlideShow = useCallback(() => {
    if (slideInterval.current) {
      clearInterval(slideInterval.current)
      slideInterval.current = null
    }
  }, [])

  useEffect(() => {
    startSlideShow()
    return () => stopSlideShow()
  }, [startSlideShow, stopSlideShow])

  return (
    <div className="relative h-48 overflow-hidden">
      <div
        className="flex transition-transform duration-500 ease-in-out h-full"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {banners.map((banner, index) => (
          <div key={index} className="w-full flex-shrink-0 h-full relative">
            <Image
              src={banner}
              alt={`Banner ${index + 1}`}
              fill
              className="object-cover"
              priority={index === 0}
            />
          </div>
        ))}
      </div>

      {/* Dots indicator */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${index === currentSlide ? 'bg-white' : 'bg-white/50'
              }`}
          />
        ))}
      </div>
    </div>
  )
})

BannerSlider.displayName = 'BannerSlider'
