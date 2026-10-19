'use client'

/**
 * Confetti Burst — กระดาษสีพุ่งครั้งเดียวตอนแลกรางวัลสำเร็จ
 * แนวทางจาก Confetti ของ Magic UI บน 21st.dev (https://21st.dev/@dillionverma/components/confetti)
 * แต่เขียนเองด้วย framer-motion — ต้นฉบับใช้ canvas-confetti ซึ่งไม่ได้อนุมัติให้ติดตั้งเพิ่ม (2026-10-19)
 *
 * กติกา (ตามคำแนะนำ 21st.dev blog เรื่อง confetti):
 *   - ยิงครั้งเดียวต่อเหตุการณ์ (เปลี่ยน burstKey = ยิงใหม่) ไม่ยิงทุก render
 *   - pointer-events: none → ไม่บังปุ่ม/dialog ข้างใต้
 *   - ถอดตัวเองออกเมื่อเล่นจบ · prefers-reduced-motion → ไม่แสดงเลย
 */
import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const COLORS = ['#ef4444', '#f59e0b', '#fbbf24', '#10b981', '#3b82f6', '#ec4899']
const PIECES = 48
const DURATION_S = 1.8

interface ConfettiBurstProps {
  /** null = ไม่ยิง · เปลี่ยนค่า (เช่น Date.now()) = ยิงหนึ่งครั้ง */
  burstKey: number | null
}

export function ConfettiBurst({ burstKey }: ConfettiBurstProps) {
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    if (burstKey === null || reduceMotion) return
    setActive(burstKey)
    const t = setTimeout(() => setActive(null), DURATION_S * 1000 + 200)
    return () => clearTimeout(t)
  }, [burstKey, reduceMotion])

  // สุ่มทิศทางต่อการยิงแต่ละครั้ง (ค่าคงที่ระหว่าง render ของรอบเดียวกัน)
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => {
        const angle = (-90 + (Math.random() - 0.5) * 110) * (Math.PI / 180) // พุ่งขึ้นเป็นรูปพัด
        const speed = 220 + Math.random() * 260
        return {
          id: i,
          color: COLORS[i % COLORS.length],
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          rotate: (Math.random() - 0.5) * 720,
          w: 6 + Math.random() * 6,
          h: 8 + Math.random() * 8,
          round: Math.random() < 0.3,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active]
  )

  if (active === null) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={`${active}-${p.id}`}
          className="absolute left-1/2 bottom-1/4 block"
          style={{
            width: p.w,
            height: p.round ? p.w : p.h,
            backgroundColor: p.color,
            borderRadius: p.round ? 9999 : 2,
          }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{
            // ขึ้นไปตามแรงส่ง แล้วตกลงด้วยแรงโน้มถ่วง (keyframe 3 จุด)
            x: [0, p.dx * 0.8, p.dx],
            y: [0, p.dy, p.dy + 420],
            rotate: p.rotate,
            opacity: [1, 1, 0],
          }}
          transition={{ duration: DURATION_S, ease: ['easeOut', 'easeIn'], times: [0, 0.4, 1] }}
        />
      ))}
    </div>
  )
}
