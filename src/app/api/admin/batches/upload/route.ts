/**
 * POST /api/admin/batches/upload — Sprint 4 (+ Sprint 9R: รหัสลูกค้า cross-check, ยอดซ้ำ)
 * multipart .xlsx + { week_start, week_end } → parse + dry-run → preview
 *
 * ⚠️ endpoint นี้ "ไม่เขียนแต้มเข้าใคร" — สร้าง point_batches status='previewed' เก็บ raw_rows ไว้
 *    จากนั้น POST /:id/submit (ส่งให้ผู้อนุมัติ) → POST /:id/commit (ผู้อนุมัติ · RPC award_points_from_batch)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import {
  parseSalesBatch,
  BatchFileError,
  type CampaignLookup,
  type SalesRepLookup,
} from '@/lib/excel/parse-sales-batch'
import SPEC from '@/lib/excel/sales-columns.json'

export const runtime = 'nodejs' // exceljs ต้องการ Node API (Buffer/zlib) ใช้ edge ไม่ได้

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CHUNK = 200 // ขนาดก้อนตอน query .in() — กัน URL ยาวเกินของ PostgREST

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requirePermission(PERMISSIONS.BATCHES_UPLOAD)
    const supabase = createServerSupabaseClient()

    // ---------------- form data ----------------
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: 'อ่านไฟล์ที่อัปโหลดไม่ได้ (ต้องส่งเป็น multipart/form-data)' }, { status: 400 })
    }

    const weekStart = String(form.get('week_start') ?? '')
    const weekEnd = String(form.get('week_end') ?? '')
    if (!ISO_DATE.test(weekStart) || !ISO_DATE.test(weekEnd)) {
      return NextResponse.json({ error: 'ต้องระบุ week_start และ week_end เป็นรูปแบบ YYYY-MM-DD' }, { status: 400 })
    }
    if (weekEnd < weekStart) {
      return NextResponse.json({ error: 'week_end ต้องไม่มาก่อน week_start' }, { status: 400 })
    }

    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลด (field ชื่อ "file")' }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ error: 'รับเฉพาะไฟล์ .xlsx เท่านั้น' }, { status: 400 })
    }
    if (file.size > SPEC.limits.maxFileBytes) {
      const mb = (SPEC.limits.maxFileBytes / 1024 / 1024).toFixed(0)
      return NextResponse.json({ error: `ไฟล์ใหญ่เกิน ${mb} MB` }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileSha256 = createHash('sha256').update(buffer).digest('hex')

    // ---------------- กันไฟล์ซ้ำ ----------------
    // committed → กัน (บิลเดียวได้แต้มครั้งเดียว · ต้อง void ก่อนถ้าจะส่งใหม่)
    // pending_approval → กัน (ส่งให้ผู้อนุมัติไปแล้ว · ผู้อนุมัติต้องปฏิเสธชุดนั้นก่อน ไม่งั้นมี 2 ชุดในคิว)
    // previewed/draft → ไฟล์เดิมที่ยังไม่เคยให้แต้ม (เช่น เลือกสัปดาห์ผิดแล้วอัปใหม่) — ไม่มี ledger/
    //   transaction อ้างถึง จึงลบ preview เก่าทิ้งแล้วทำ preview ใหม่แทน ไม่งั้นบัญชีติดตายที่ 409
    //   (index point_batches_file_hash_idx กัน hash ซ้ำทุกสถานะที่ไม่ใช่ voided)
    const { data: dupBatch, error: dupErr } = await supabase
      .from('point_batches')
      .select('id, status, created_at, file_name, week_start, week_end')
      .eq('file_sha256', fileSha256)
      .neq('status', 'voided')
      .maybeSingle()
    if (dupErr) {
      console.error('[batches/upload] dup check failed:', dupErr)
      return NextResponse.json({ error: 'ตรวจไฟล์ซ้ำไม่สำเร็จ' }, { status: 500 })
    }
    let replacedPreviewId: string | null = null
    if (dupBatch) {
      if (dupBatch.status === 'pending_approval') {
        return NextResponse.json(
          {
            error: `ไฟล์นี้ถูกส่งให้ผู้อนุมัติไปแล้ว (batch "${dupBatch.file_name}" สัปดาห์ ${dupBatch.week_start} → ${dupBatch.week_end}) — ให้ผู้อนุมัติปฏิเสธชุดนั้นก่อน ถ้าต้องการส่งไฟล์ใหม่`,
            detail: `ตรงกับ batch "${dupBatch.file_name}" (สถานะ ${dupBatch.status}) เมื่อ ${dupBatch.created_at}`,
            batch_id: dupBatch.id,
          },
          { status: 409 }
        )
      }
      if (dupBatch.status === 'committed') {
        return NextResponse.json(
          {
            error: `ไฟล์นี้ให้แต้มเข้าไปแล้ว (batch "${dupBatch.file_name}" สัปดาห์ ${dupBatch.week_start} → ${dupBatch.week_end}) — ถ้าไฟล์ผิดให้ยกเลิกทั้งชุด (Rollback) ก่อนแล้วค่อยอัปโหลดใหม่`,
            detail: `ตรงกับ batch "${dupBatch.file_name}" (สถานะ ${dupBatch.status}) เมื่อ ${dupBatch.created_at}`,
            batch_id: dupBatch.id,
          },
          { status: 409 }
        )
      }
      const { error: delErr } = await supabase
        .from('point_batches')
        .delete()
        .eq('id', dupBatch.id)
        .in('status', ['previewed', 'draft'])
      if (delErr) {
        console.error('[batches/upload] replace stale preview failed:', delErr)
        return NextResponse.json({ error: 'ลบ preview เดิมของไฟล์นี้ไม่สำเร็จ' }, { status: 500 })
      }
      replacedPreviewId = dupBatch.id
    }

    // ---------------- lookup ที่ parser ต้องใช้ ----------------
    const [settingRes, repsRes, campaignsRes] = await Promise.all([
      supabase.from('point_settings').select('setting_value').eq('setting_key', 'baht_per_point').maybeSingle(),
      supabase.from('sales_reps').select('id, code, full_name, is_active'),
      supabase.from('point_campaigns').select('id, name, multiplier, starts_on, ends_on').eq('is_active', true),
    ])

    if (settingRes.error || repsRes.error || campaignsRes.error) {
      console.error('[batches/upload] lookup failed:', settingRes.error, repsRes.error, campaignsRes.error)
      return NextResponse.json({ error: 'ดึงข้อมูลตั้งค่าไม่สำเร็จ' }, { status: 500 })
    }

    const bahtPerPoint = Number(settingRes.data?.setting_value)
    if (!Number.isFinite(bahtPerPoint) || bahtPerPoint <= 0) {
      // ห้าม fallback เป็น 100 เงียบ ๆ — คิดแต้มผิดทั้ง batch โดยไม่มีใครรู้
      return NextResponse.json(
        { error: 'ค่า baht_per_point ใน point_settings ไม่ถูกต้อง — ตั้งค่าที่ /admin/point-settings ก่อน' },
        { status: 500 }
      )
    }

    const salesReps = (repsRes.data ?? []) as SalesRepLookup[]
    const activeCampaigns = (campaignsRes.data ?? []).map((c) => ({
      ...c,
      multiplier: Number(c.multiplier),
    })) as CampaignLookup[]

    // ---------------- รอบแรก: อ่านไฟล์เพื่อดึงเบอร์/เลขบิลที่ต้องไปเช็คกับ DB ----------------
    // parse 2 รอบโดยตั้งใจ: รอบแรก lookup ว่าง → ได้ค่าที่ normalize แล้วมาไป query
    // รอบสองค่อยตัดสินสถานะจริง · ไฟล์ ≤ 5,000 แถว ต้นทุนน้อยกว่าการเขียน parser 2 โหมด
    const probe = await parseSalesBatch(buffer, {
      weekStart,
      weekEnd,
      bahtPerPoint,
      salesReps,
      activeCampaigns,
      usersByPhone: new Map(),
      billsInUse: new Map(),
    })

    const phones = [...new Set(probe.rows.map((r) => r.phone).filter((p): p is string => !!p))]
    const bills = [...new Set(probe.rows.map((r) => r.bill_no).filter((b): b is string => !!b))]

    // เบอร์ → user_id · user_id → customer_code (cross-check คอลัมน์ รหัสลูกค้า · เบอร์เป็น key เสมอ)
    const usersByPhone = new Map<string, string>()
    const customerCodeByUserId = new Map<string, string | null>()
    for (const part of chunk(phones, CHUNK)) {
      const { data, error } = await supabase.from('user_profiles').select('id, phone, customer_code').in('phone', part)
      if (error) {
        console.error('[batches/upload] phone lookup failed:', error)
        return NextResponse.json({ error: 'ค้นหาลูกค้าจากเบอร์ไม่สำเร็จ' }, { status: 500 })
      }
      for (const u of data ?? []) {
        if (!u.phone) continue
        usersByPhone.set(u.phone, u.id)
        customerCodeByUserId.set(u.id, u.customer_code ?? null)
      }
    }

    // เลขบิลที่ถูกใช้ไปแล้ว (ledger ที่ยังไม่ถูก void)
    //
    // ใช้ .in() ไม่ใช่ .or(...ilike...) โดยตั้งใจ: ilike มองว่า % และ _ เป็น wildcard
    // เลขบิลที่มี _ (เช่น INV_001) จะไป match บิลอื่นผิด ๆ แล้วโดนตีว่า "ใช้แล้ว"
    // = ปฏิเสธยอดขายที่ถูกต้องแบบเงียบ ๆ · PostgREST ไม่เปิดให้ใส่ ESCAPE ด้วย
    // .in() ให้ supabase-js escape เอง ไม่มี wildcard → ส่งทั้ง 3 รูปแบบตัวพิมพ์แทน
    //
    // ช่องที่เหลือ: ตัวพิมพ์ผสมแปลก ๆ (เก็บ "InV-001" แต่อัปมา "inv-001") จะหลุด preview
    // แต่ unique index upper(btrim(bill_no)) จะเตะตอน commit (ทั้ง batch rollback) — ล้มดัง ไม่เงียบ
    const billsInUse = new Map<string, string>()
    const billVariants = [...new Set(bills.flatMap((b) => [b, b.toUpperCase(), b.toLowerCase()]))]
    for (const part of chunk(billVariants, CHUNK)) {
      const { data, error } = await supabase
        .from('point_batch_ledger')
        .select('bill_no, source_batch_id')
        .eq('voided', false)
        .in('bill_no', part)
      if (error) {
        console.error('[batches/upload] bill lookup failed:', error)
        return NextResponse.json({ error: 'ตรวจเลขที่บิลซ้ำไม่สำเร็จ' }, { status: 500 })
      }
      for (const l of data ?? []) {
        if (l.bill_no) billsInUse.set(l.bill_no.trim().toUpperCase(), l.source_batch_id ?? '')
      }
    }

    // ---------------- รอบสอง: ตัดสินสถานะจริง ----------------
    const result = await parseSalesBatch(buffer, {
      weekStart,
      weekEnd,
      bahtPerPoint,
      salesReps,
      activeCampaigns,
      usersByPhone,
      customerCodeByUserId,
      billsInUse,
      duplicateAmountPolicy: 'warn', // Q2 ยังไม่ตอบ → เตือน ไม่ reject (สลับที่นี่ที่เดียวถ้าตอบว่า reject)
    })

    // ---------------- บันทึก preview ----------------
    const { data: batch, error: insertErr } = await supabase
      .from('point_batches')
      .insert({
        uploaded_by: admin.id,
        file_name: file.name,
        file_sha256: fileSha256,
        week_start: weekStart,
        week_end: weekEnd,
        status: 'previewed',
        total_rows: result.summary.total,
        // valid_rows = แถวที่จะได้แต้มตอนอนุมัติ (valid + duplicate_amount) — ตรงกับที่ RPC ให้แต้ม
        valid_rows: result.summary.valid + result.summary.duplicate_amount,
        invalid_rows: result.summary.invalid,
        unmatched_rows: result.summary.unmatched,
        total_points: result.summary.total_points,
        raw_rows: result.rows,
      })
      .select('id')
      .single()

    if (insertErr || !batch) {
      console.error('[batches/upload] insert failed:', insertErr)
      return NextResponse.json({ error: 'บันทึก preview ไม่สำเร็จ' }, { status: 500 })
    }

    return NextResponse.json({
      batch_id: batch.id,
      replaced_preview_id: replacedPreviewId,
      file_name: file.name,
      file_sha256: fileSha256,
      week_start: weekStart,
      week_end: weekEnd,
      baht_per_point: bahtPerPoint,
      summary: result.summary,
      rows: result.rows,
    })
  } catch (error: unknown) {
    if (error instanceof BatchFileError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: 422 })
    }
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('[batches/upload] unexpected error:', error)
    return NextResponse.json({ error: 'อัปโหลดไม่สำเร็จ' }, { status: 500 })
  }
}
