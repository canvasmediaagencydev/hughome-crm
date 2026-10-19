'use client'

/**
 * Number Ticker — ตัวเลขวิ่งไปหาค่าเป้าหมาย
 * ที่มา: Magic UI (MIT) https://magicui.design/docs/components/number-ticker
 *        ตัวเดียวกับบน 21st.dev https://21st.dev/dillionverma/number-ticker
 * ปรับจากต้นฉบับ: import จาก framer-motion (ต้นฉบับใช้ motion/react) · เคารพ prefers-reduced-motion
 *               (แสดงค่าจริงทันที) · ไม่ใส่สีตัวอักษรเอง ให้ผู้เรียกกำหนด
 * ค่าเปลี่ยนภายหลัง (เช่นเปลี่ยนช่วงวันที่) → วิ่งจากค่าเดิมไปค่าใหม่
 */
import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'
import { useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

import { cn } from '@/lib/utils'

interface NumberTickerProps extends ComponentPropsWithoutRef<'span'> {
  value: number
  startValue?: number
  delay?: number
  decimalPlaces?: number
}

export function NumberTicker({
  value,
  startValue = 0,
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduceMotion = useReducedMotion()
  const motionValue = useMotionValue(startValue)
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 })
  const isInView = useInView(ref, { once: true, margin: '0px' })

  const format = (n: number) =>
    Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(Number(n.toFixed(decimalPlaces)))

  useEffect(() => {
    if (reduceMotion) {
      if (ref.current) ref.current.textContent = format(value)
      return
    }
    if (!isInView) return
    const timer = setTimeout(() => motionValue.set(value), delay * 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motionValue, isInView, delay, value, reduceMotion, decimalPlaces])

  // ค่าเป้าหมายล่าสุด — ใช้ตอน spring หยุด
  const targetRef = useRef(value)
  targetRef.current = value

  useEffect(() => {
    const offChange = springValue.on('change', (latest) => {
      if (ref.current && !reduceMotion) ref.current.textContent = format(latest)
    })
    // spring หยุดเมื่อเข้าใกล้เป้า (restDelta) ซึ่งอาจยังห่างไม่ถึง 1 → ตัวเลขค้างที่ value-1
    // (ต้นฉบับ Magic UI เป็นแบบนี้: 12,850 โชว์ 12,849) · ยอดแต้มต้องตรงเสมอ จึงเขียนค่าจริงทับตอนจบ
    const offComplete = springValue.on('animationComplete', () => {
      if (ref.current && !reduceMotion) ref.current.textContent = format(targetRef.current)
    })
    return () => {
      offChange()
      offComplete()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [springValue, decimalPlaces, reduceMotion])

  return (
    <span ref={ref} className={cn('inline-block tabular-nums', className)} {...props}>
      {format(reduceMotion ? value : startValue)}
    </span>
  )
}
