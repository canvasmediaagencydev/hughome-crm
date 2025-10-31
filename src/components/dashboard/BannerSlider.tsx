import { memo } from 'react'
import Image from 'next/image'

export const BannerSlider = memo(() => {
  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-br from-red-500 to-red-600">
      {/* Main Banner Container with improved styling */}
      <div className="relative w-full aspect-[16/7] md:aspect-[21/9]">
        <Image
          src="/image/banner.svg"
          alt="Hughome Banner"
          fill
          className="object-cover"
          priority
        />

        {/* Gradient Overlay for better text visibility if needed */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      </div>

      {/* Optional: Decorative Corner Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-tr-full" />
    </div>
  )
})

BannerSlider.displayName = 'BannerSlider'
