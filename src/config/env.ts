/**
 * Centralized environment-variable validation (Sprint 0).
 *
 * Every required env var for the pilot instance is declared here and validated
 * with zod. If anything is missing or malformed, boot fails LOUDLY with the
 * exact variable name(s) — there is NO silent fallback anywhere in the app.
 *
 * Why this exists: the old code did `process.env.X || "<hardcoded production value>"`,
 * which meant a mis-configured pilot would silently route testers into the REAL
 * Mae Rim production system. See MIGRATION_PLAN.md §9.1.
 *
 * Design notes:
 *  - Client vs server schemas are split. `NEXT_PUBLIC_*` vars are inlined by
 *    Next.js and safe in the browser; server-only secrets must never reach the
 *    client bundle, so `serverEnv` throws on any access from the browser.
 *  - Validation is EAGER: it runs at module import (MIGRATION_PLAN.md §3 —
 *    "fail ตอน import module ให้เร็วที่สุด"). This module is also imported from
 *    next.config.ts, so any Next command (build/dev/start) fails at boot with a
 *    clear, named list if env is missing — before route modules are evaluated.
 *
 * The DB-side cross-check of TENANT.code vs app_config.tenant_code (§9.1) is
 * implemented in src/config/tenant-guard.ts, run at server boot via
 * src/instrumentation.ts (it needs a runtime DB query, so it can't live here
 * where validation must also pass during `next build`).
 */
import { z } from 'zod'

// A required, non-empty string. The `error` param covers the missing/undefined
// case; `.min(1)` covers the present-but-empty case.
const requiredStr = (label: string) =>
  z.string({ error: `${label} is required (ตัวแปรหาย/ไม่ได้ตั้งค่า)` }).min(1, `${label} is required (ค่าว่าง)`)

// A required URL (http/https). Uses refine to stay independent of zod's
// version-specific `.url()` API.
const requiredUrl = (label: string) =>
  requiredStr(label).refine((v) => /^https?:\/\//.test(v), `${label} must be a URL starting with http:// or https://`)

// ---------------------------------------------------------------------------
// Client env — safe to expose to the browser (NEXT_PUBLIC_* only)
// ---------------------------------------------------------------------------
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: requiredUrl('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredStr('NEXT_PUBLIC_SUPABASE_ANON_KEY'),

  NEXT_PUBLIC_LINE_LIFF_ID: requiredStr('NEXT_PUBLIC_LINE_LIFF_ID'),

  // Tenant config (MIGRATION_PLAN.md §3.1)
  NEXT_PUBLIC_TENANT_CODE: z.enum(['pilot', 'mae_rim', 'fa_ham']),
  NEXT_PUBLIC_TENANT_NAME: requiredStr('NEXT_PUBLIC_TENANT_NAME'),
  NEXT_PUBLIC_TENANT_SEGMENT: z.enum(['B2B', 'B2C']),
  NEXT_PUBLIC_TENANT_PHONE: requiredStr('NEXT_PUBLIC_TENANT_PHONE'),
  NEXT_PUBLIC_TENANT_LINE_OA: requiredStr('NEXT_PUBLIC_TENANT_LINE_OA'),
  NEXT_PUBLIC_TENANT_FB_URL: requiredUrl('NEXT_PUBLIC_TENANT_FB_URL'),
  // NOTE: no NEXT_PUBLIC_GEMINI_API_KEY here — a public var is inlined into the
  // client bundle for anyone to read. OCR is a Non-Goal (§13); the key, if ever
  // needed, lives server-side only as GEMINI_API_KEY (serverSchema below).
})

// ---------------------------------------------------------------------------
// Server env — never sent to the client
// ---------------------------------------------------------------------------
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: requiredStr('SUPABASE_SERVICE_ROLE_KEY'),

  // LINE Login channel id — used by JWKS `aud` verification (Sprint 2).
  LINE_CHANNEL_ID: requiredStr('LINE_CHANNEL_ID'),
  // Messaging API token for push / audience.
  LINE_CHANNEL_ACCESS_TOKEN: requiredStr('LINE_CHANNEL_ACCESS_TOKEN'),

  CRON_SECRET: requiredStr('CRON_SECRET'),

  // Signing key for the server session cookie (HS256). Generate: openssl rand -hex 32
  SESSION_SECRET: requiredStr('SESSION_SECRET'),

  // Optional / future.
  GEMINI_API_KEY: z.string().optional(),
  NOTIFICATIONS_ENABLED: z.string().optional(),

  // Sprint 8 — คีย์เข้ารหัส Telegram bot token ใน notification_channels (AES-256-GCM, §9.5).
  // 64 hex = 32 bytes · สร้าง: openssl rand -hex 32
  // optional ตอน boot เพื่อไม่ให้ instance ที่ยังไม่ใช้ Telegram ล้ม — แต่ตอน "ใช้" (บันทึก/ส่ง
  // channel ที่มี token) ถ้าไม่มีจะ throw ทันที ไม่มี fallback (src/lib/secret-box.ts)
  NOTIFY_TOKEN_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'NOTIFY_TOKEN_KEY must be 64 hex characters (openssl rand -hex 32)')
    .optional(),
})

export type ClientEnv = z.infer<typeof clientSchema>
export type ServerEnv = z.infer<typeof serverSchema>

function formatIssues(scope: string, error: z.ZodError): string {
  const lines = error.issues.map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
  return (
    `\n❌ [env] ${scope} ไม่ถูกต้อง/ไม่ครบ — แก้ให้ครบก่อนรัน:\n${lines}\n\n` +
    `ดูว่าแต่ละตัวเอามาจากไหนได้ที่ .env.example (คัดลอกเป็น .env.local แล้วเติมค่า)\n`
  )
}

// `NEXT_PUBLIC_*` must be referenced as static literals so Next.js can inline
// them into the client bundle — do NOT rebuild this via dynamic keys.
const rawClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_LINE_LIFF_ID: process.env.NEXT_PUBLIC_LINE_LIFF_ID,
  NEXT_PUBLIC_TENANT_CODE: process.env.NEXT_PUBLIC_TENANT_CODE,
  NEXT_PUBLIC_TENANT_NAME: process.env.NEXT_PUBLIC_TENANT_NAME,
  NEXT_PUBLIC_TENANT_SEGMENT: process.env.NEXT_PUBLIC_TENANT_SEGMENT,
  NEXT_PUBLIC_TENANT_PHONE: process.env.NEXT_PUBLIC_TENANT_PHONE,
  NEXT_PUBLIC_TENANT_LINE_OA: process.env.NEXT_PUBLIC_TENANT_LINE_OA,
  NEXT_PUBLIC_TENANT_FB_URL: process.env.NEXT_PUBLIC_TENANT_FB_URL,
}

function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown, scope: string): T {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new Error(formatIssues(scope, parsed.error))
  return parsed.data
}

/**
 * Validated client env. Validated EAGERLY at module import (MIGRATION_PLAN.md
 * §3 / Sprint 0: "fail ตอน import module ให้เร็วที่สุด"). NEXT_PUBLIC_* only, so
 * this is safe to evaluate on both server and client.
 */
export const clientEnv: ClientEnv = parseOrThrow(clientSchema, rawClientEnv, 'Client env (NEXT_PUBLIC_*)')

/**
 * Validated server env — server-only secrets.
 *  - On the server: validated EAGERLY at import so boot fails fast if anything
 *    is missing.
 *  - In the browser: never validated, and any property access throws — this
 *    guarantees server secrets can never be read from (or inlined into) the
 *    client bundle.
 */
export const serverEnv: ServerEnv =
  typeof window === 'undefined'
    ? parseOrThrow(serverSchema, process.env, 'Server env')
    : new Proxy({} as ServerEnv, {
        get() {
          throw new Error('[env] serverEnv ถูกอ่านฝั่ง client — server secret ห้ามหลุดเข้า browser')
        },
      })
