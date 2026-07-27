/**
 * Tenant (branch) configuration — MIGRATION_PLAN.md §3.1
 *
 * The system runs one isolated instance per branch (separate DB, LINE, deploy).
 * All branch-specific values come from `NEXT_PUBLIC_TENANT_*` env vars so that
 * Phase 2 only needs an env change per instance — no code edits.
 *
 * Values are read from the validated `clientEnv` (see src/config/env.ts), NOT
 * via `process.env.X!`, so a missing var fails loudly at import time instead of
 * yielding a silent `undefined`.
 */
import { clientEnv } from './env'

// `clientEnv` is already validated at import (src/config/env.ts), so every field
// here is guaranteed present — there is NO default / fallback anywhere. A missing
// tenant var fails at import time, not silently as `undefined`.
export const TENANT = {
  /** 'pilot' | 'mae_rim' | 'fa_ham' */
  code: clientEnv.NEXT_PUBLIC_TENANT_CODE,
  /** Display name, e.g. 'ฟ้าฮ่าม' */
  name: clientEnv.NEXT_PUBLIC_TENANT_NAME,
  /** 'B2B' | 'B2C' */
  segment: clientEnv.NEXT_PUBLIC_TENANT_SEGMENT,
  /** Store phone number shown on the /call page */
  phone: clientEnv.NEXT_PUBLIC_TENANT_PHONE,
  /** LINE Official Account id / basic id */
  lineOaId: clientEnv.NEXT_PUBLIC_TENANT_LINE_OA,
  /** Facebook page URL */
  facebookUrl: clientEnv.NEXT_PUBLIC_TENANT_FB_URL,
} as const
