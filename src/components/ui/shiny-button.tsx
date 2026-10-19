'use client'

/**
 * Shiny Button — ปุ่มหลักที่มีแสงวิ่งผ่านเป็นระยะ ให้เด่นกว่าปุ่มอื่นในหน้า
 * ที่มา: Shiny Button ของ Magic UI (MIT) https://21st.dev/community/components/dillionverma/shiny-button
 * ปรับจากต้นฉบับ: ครอบ Button ของ shadcn (สี/ขนาด/variant เดิมของระบบ) แทน motion.button ของต้นฉบับ
 *               ไม่ mask ตัวอักษร (ต้นฉบับทำให้ข้อความจางเป็นช่วง ๆ — อ่านยอดเงินบนปุ่มอนุมัติลำบาก)
 *               แสงหยุดเมื่อ disabled และเมื่อ prefers-reduced-motion
 */
import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ShinyButtonProps = React.ComponentProps<typeof Button>

export function ShinyButton({ className, children, disabled, ...props }: ShinyButtonProps) {
  const reduceMotion = useReducedMotion()
  return (
    <Button className={cn('relative overflow-hidden', className)} disabled={disabled} {...props}>
      {!disabled && !reduceMotion && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          initial={{ x: '-150%' }}
          animate={{ x: '400%' }}
          transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.2 }}
        />
      )}
      <span className="relative inline-flex items-center">{children}</span>
    </Button>
  )
}
