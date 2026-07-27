/**
 * Thai phone normalization — single canonical format across the whole system.
 *
 * CANONICAL = local 10-digit `0xxxxxxxxx` (starts 0 + [689]).
 * Reason: the weekly Excel batch upload matches customers by phone using exactly
 * this format (MIGRATION_PLAN.md §12: "auto-fix 8xx → 08xx", "10 หลักขึ้นต้น 0[689]").
 * Points flow through phone matching, so identity is stored/compared in this one
 * format everywhere. E.164 (+66) is used ONLY as transport when calling Supabase
 * Auth (which requires it) — never as the stored identity.
 */

/** → '0xxxxxxxxx' or null if not a valid Thai mobile number. */
export function normalizeThaiPhone(input: string | null | undefined): string | null {
  if (!input) return null
  let d = String(input).replace(/\D/g, '')
  if (d.startsWith('66')) d = '0' + d.slice(2) // +66xxxxxxxxx → 0xxxxxxxxx
  else if (d.length === 9 && /^[689]/.test(d)) d = '0' + d // 8xxxxxxxx → 08xxxxxxxx
  return /^0[689]\d{8}$/.test(d) ? d : null
}

/** → '+66xxxxxxxxx' (for Supabase Auth) or null if invalid. */
export function toE164Thai(input: string | null | undefined): string | null {
  const local = normalizeThaiPhone(input)
  return local ? '+66' + local.slice(1) : null
}
