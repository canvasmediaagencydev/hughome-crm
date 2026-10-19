'use client'

/**
 * Magic Card — ขอบและแสงเรืองตามตำแหน่งเมาส์
 * ที่มา: Magic UI (MIT) https://magicui.design/docs/components/magic-card
 *        ตัวเดียวกับบน 21st.dev https://21st.dev/community/components/dillionverma/magic-card
 * ปรับจากต้นฉบับ: ใช้เฉพาะโหมด gradient (ตัดโหมด orb + next-themes ออก — ระบบไม่มี dark mode)
 *               import จาก framer-motion · เพิ่ม backgroundClassName / borderColor สำหรับการ์ดที่ไฮไลต์
 * จอสัมผัสไม่มี hover → การ์ดแสดงเหมือนการ์ดปกติ
 */
import React, { useCallback } from 'react'
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion'

import { cn } from '@/lib/utils'

interface MagicCardProps {
  children?: React.ReactNode
  className?: string
  /** พื้นการ์ด (ชั้นล่างสุดใต้แสง) */
  backgroundClassName?: string
  /** สีขอบตอนเมาส์ไม่อยู่ใกล้ */
  borderColor?: string
  gradientSize?: number
  /** สีแสงบนพื้นการ์ด */
  gradientColor?: string
  gradientOpacity?: number
  /** สีขอบเรืองใต้เมาส์ */
  gradientFrom?: string
  gradientTo?: string
}

export function MagicCard({
  children,
  className,
  backgroundClassName = 'bg-background',
  borderColor = 'var(--color-border)',
  gradientSize = 200,
  gradientColor = '#f1f5f9',
  gradientOpacity = 0.8,
  gradientFrom = '#ef4444',
  gradientTo = '#f59e0b',
}: MagicCardProps) {
  const mouseX = useMotionValue(-gradientSize)
  const mouseY = useMotionValue(-gradientSize)

  const reset = useCallback(() => {
    mouseX.set(-gradientSize)
    mouseY.set(-gradientSize)
  }, [mouseX, mouseY, gradientSize])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      mouseX.set(e.clientX - rect.left)
      mouseY.set(e.clientY - rect.top)
    },
    [mouseX, mouseY]
  )

  const borderBackground = useMotionTemplate`
    linear-gradient(var(--color-background) 0 0) padding-box,
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      ${gradientFrom},
      ${gradientTo},
      ${borderColor} 100%
    ) border-box
  `
  const glowBackground = useMotionTemplate`
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      ${gradientColor},
      transparent 100%
    )
  `

  return (
    <motion.div
      className={cn('group relative isolate overflow-hidden border border-transparent', className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      style={{ background: borderBackground }}
    >
      <div className={cn('absolute inset-px z-20 rounded-[inherit]', backgroundClassName)} />
      <motion.div
        aria-hidden="true"
        // แสงอยู่นอกการ์ดเมื่อเมาส์ออก (reset) จึงไม่ต้องซ่อนด้วย opacity
        className="pointer-events-none absolute inset-px z-30 rounded-[inherit]"
        style={{ background: glowBackground, opacity: gradientOpacity }}
      />
      <div className="relative z-40">{children}</div>
    </motion.div>
  )
}
