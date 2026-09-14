/**
 * แปล error จาก requirePermission ให้เป็น 401/403 — ใช้ใน catch ของ admin route
 * (แบบเดียวกับ campaignAuthError ใน campaigns-server.ts · batches/route.ts)
 * คืน null ถ้าไม่ใช่ auth error → route ตอบ 500 ของตัวเอง
 */
import { NextResponse } from 'next/server'

export function adminAuthError(error: unknown): NextResponse | null {
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (message.startsWith('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}
