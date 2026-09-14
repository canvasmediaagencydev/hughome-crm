/**
 * Server-side helpers for /api/admin/campaigns — แยกจาก src/lib/campaigns.ts
 * เพราะ route.ts ของ Next ห้าม export อะไรนอกจาก HTTP handler
 */
import { NextResponse } from 'next/server'
import type { createServerSupabaseClient } from '@/lib/supabase-server'
import { findOverlapping, type CampaignRange } from '@/lib/campaigns'

type Supabase = ReturnType<typeof createServerSupabaseClient>

export function campaignAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (message.startsWith('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

/** แคมเปญ active ที่ทับช่วง (ใช้ทั้ง pre-check และตอนแปล 23P01) */
export async function findConflict(
  supabase: Supabase,
  starts_on: string,
  ends_on: string,
  excludeId?: string
): Promise<CampaignRange | null> {
  const { data, error } = await supabase
    .from('point_campaigns')
    .select('id, name, starts_on, ends_on, is_active')
    .eq('is_active', true)
    .lte('starts_on', ends_on)
    .gte('ends_on', starts_on)
  if (error) {
    console.error('[campaigns] overlap lookup failed:', error)
    return null
  }
  return findOverlapping(data ?? [], starts_on, ends_on, excludeId)
}
