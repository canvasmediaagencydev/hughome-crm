import { NextRequest } from 'next/server'
import { serverEnv } from '@/config/env'

/**
 * Verify a Vercel Cron / internal request via the shared CRON_SECRET.
 * CRON_SECRET comes from the validated env (src/config/env.ts) — guaranteed
 * present, so there is no silent "no secret configured" bypass path.
 */
export function verifyCronRequest(request: NextRequest): boolean {
  const expected = `Bearer ${serverEnv.CRON_SECRET}`
  const header = request.headers.get('authorization')
  return header === expected
}
