# HugHome CRM — Migration Plan (v3 · แบ่ง 2 Phase)

**Paradigm shift:** `ลูกค้าถ่ายใบเสร็จ → OCR → Admin approve` → **`พนักงานขาย key Excel → บัญชี Batch Upload → ผู้จัดการสุ่มตรวจ → แต้มเข้า LINE`**

**สถานะ:** แผน (ยังไม่แตะ code) · v3 แทนที่ v2 ทั้งฉบับ
**อัปเดต:** 25 ก.ค. 2569

---

## 0. ขอบเขตของแต่ละ Phase

| | **Phase 1 — Pilot (ทำตอนนี้)** | **Phase 2 — Production Migration (ทีหลัง)** |
|---|---|---|
| เป้าหมาย | สร้างระบบใหม่ทั้งชุด **บน LINE ใหม่ + ฐานข้อมูลใหม่** ให้ลูกค้าทดลองเล่นและตรวจก่อน | ย้ายข้อมูลสาขาแม่ริม (ระบบ production เดิม) เข้าสู่ระบบใหม่ |
| LINE | **OA / Login channel / LIFF ใหม่ทั้งหมด** | OA เดิมของแม่ริม |
| Database | Supabase ใหม่ **ฐานเปล่า** | Supabase เดิม (มีลูกค้าจริง ~700 คน) |
| ข้อมูล | seed demo data | ข้อมูลจริง |
| Backfill / cutover | **ไม่มี** | มีครบ (ledger, birthday, ใบเสร็จ pending) |
| ความเสี่ยง | ต่ำ — พังได้ ไม่กระทบใคร | สูง — แตะเงิน/แต้มลูกค้าจริง |

> **หลักการ:** Phase 1 ไม่ต้องแคร์ backward compatibility เลย ออกแบบ schema และ auth ให้ถูกตั้งแต่แรกได้ทันที
> ข้อจำกัดที่หนักที่สุดของโปรเจกต์นี้ (backfill ledger จาก `points_balance` ก้อนเดียว) **ถูกเลื่อนไป Phase 2 ทั้งหมด**

---

## 1. การตัดสินใจที่ล็อคแล้ว

| หัวข้อ | ที่ตกลง | ผลต่อการออกแบบ |
|--------|---------|------------------|
| **สถาปัตยกรรมสาขา** | แยก instance ขาด — คนละ DB, คนละ LINE, คนละ deploy | ไม่มี `branches` table · ไม่มี `branch_id` · ไม่มี branch scoping |
| **2 สาขา** | **แม่ริม** (ระบบเดิม) · **ฟ้าฮ่าม** (ระบบใหม่) | ~~มีโชค~~ แจ้งผิด — ยืนยันว่า **ฟ้าฮ่าม** ถูกต้องตามเอกสารเดิม |
| **Phase 1 ทำที่ไหน** | **LINE ใหม่ + Supabase ใหม่ ทั้งหมด** | ไม่แตะ production แม่ริมเลย |
| LINE Provider | คนละ Provider | `line_user_id` ข้ามระบบไม่ได้ · ไม่กระทบ Phase 1 |
| Batch commit model | Auto-commit + สุ่มตรวจย้อนหลัง | แต้มเข้าทันที · ต้องมี void batch ทั้งก้อน |
| ช่องแจ้งเตือนทีม | Telegram + LINE group push | LINE Notify ปิดบริการ 31 มี.ค. 2025 ใช้ไม่ได้แล้ว |
| Message Token | อ่านจาก LINE quota API | ไม่ทำ `message_token_pool` เอง |
| ยกเลิก redemption | ได้ถึงสถานะ `ready` | |
| แต้มข้ามสาขา | ไม่โอน ไม่รวม | ลูกค้ายืนยันรับได้ |
| Dashboard รวม 2 สาขา | Export Excel รวมเอง | ไม่สร้าง aggregator |
| ย้ายลูกค้าเดิม | **Phase 2** | ไม่มี Phone Claim Flow ใน Phase 1 |

---

## 2. Phase 1 — สิ่งที่ต้องส่งมอบ

### 2.1 Environment ใหม่ทั้งชุด

| ของ | หมายเหตุ |
|-----|----------|
| Supabase project ใหม่ | ฐานเปล่า · schema ตามข้อ 4 |
| LINE Provider ใหม่ | |
| ├ Messaging API channel | → `LINE_CHANNEL_ACCESS_TOKEN` (push, audience) |
| └ LINE Login channel + LIFF app | → `LINE_CHANNEL_ID`, `NEXT_PUBLIC_LINE_LIFF_ID` |
| Vercel project ใหม่ | domain แยก เช่น `pilot.hughome.app` |
| Telegram bot + group ทดสอบ | |
| `CRON_SECRET` ใหม่ | |

> ✅ **ไม่ต้องแตะ OA เดิมของฟ้าฮ่าม/แม่ริมเลยใน Phase 1** — ปัญหาเรื่องสิทธิ์เข้า LINE Developers Console ของ OA เดิม (ที่เคยเป็นตัวบล็อก) ถูกเลื่อนไป Phase 2 ด้วย

### 2.2 Feature ที่ต้องมีให้เล่นครบ

**ฝั่งลูกค้า**
- สมัครสมาชิกผ่าน LIFF (ชื่อ-สกุล · ประเภท · เบอร์ + OTP · **วันเกิด บังคับ**)
- หน้าหลัก — แต้มคงเหลือ + **วันหมดอายุก้อนถัดไป**
- แลกของรางวัล — รับที่หน้าร้านเท่านั้น
- โทรร้าน · Facebook
- Bottom nav 5 tabs (ไม่มีประวัติ ไม่มีอัปโหลดใบเสร็จ)
- รับ LINE push: แต้มเข้า · เตือนหมดอายุ · อวยพรวันเกิด

**ฝั่งแอดมิน**
- Batch Upload Excel → preview → commit → void
- จัดการ Campaign แต้มพิเศษ (ช่วงวันที่ + ตัวคูณ · ห้ามซ้อนช่วง)
- จัดการรายชื่อพนักงานขาย (ป้อน dropdown ในไฟล์ Excel)
- จัดการรางวัล + คำขอแลก (4 statuses + สแกน QR)
- จัดการผู้ใช้ + Tags
- Roles ใหม่ 3 ระดับ
- ตั้งค่า Telegram/LINE group + ปุ่มทดสอบ
- Dashboard + รายงานสัปดาห์ + export Excel
- ดูโควตา LINE คงเหลือ

**Demo data ที่ต้อง seed** — ลูกค้าตัวอย่าง ~20 คน (มีเบอร์จริงของทีมทดสอบปนอยู่บ้างเพื่อทดสอบ push) · รางวัล ~8 รายการ · campaign 2 ช่วง (ห้ามซ้อนกัน) · พนักงานขาย ~4 คน · admin 1 คนต่อ role

### 2.3 สิ่งที่ **ไม่ต้องทำ** ใน Phase 1

- ❌ Backfill ledger จาก `points_balance` (§9.1 เดิม) — ฐานเปล่า
- ❌ Backfill `birthday` — บังคับ NOT NULL ได้ตั้งแต่วันแรก
- ❌ Cutover ใบเสร็จ pending — ไม่มีใบเสร็จ
- ❌ Phone Claim Flow — ไม่ย้ายลูกค้า
- ❌ Migration ที่ต้อง reversible บนข้อมูลจริง — ลบฐานสร้างใหม่ได้ตลอด
- ❌ Dual-environment deploy + schema drift check — มี instance เดียว
- ❌ Legacy compat ของ `point_transactions` เดิม

**ผลรวม: งานหนักที่สุดของโปรเจกต์ถูกเลื่อนไป Phase 2 หมด**

---

### 2.4 🎬 Demo Readiness Checklist — สิ่งที่ต้องมีนอกเหนือจาก code

งานเหล่านี้ **ไม่ใช่งานเขียนโปรแกรม** แต่ถ้าไม่ทำ demo จะเล่นไม่ได้เลย

#### A. SMS / OTP ← ตัวบล็อกใหญ่ที่สุด

โค้ดเรียก `supabase.auth.signInWithOtp({ phone })` → ต้องเปิด **Supabase Phone Auth + SMS provider**
ถ้าไม่ตั้ง: OTP ส่งไม่ออก → สมัครไม่ได้ → **ทดสอบอะไรไม่ได้เลยสักอย่าง**

| ทางเลือก | ต้นทุน | ใช้เมื่อไหร่ |
|---|---|---|
| **Test OTP ของ Supabase** ← แนะนำสำหรับ Phase 1 | ฟรี | Dashboard → Authentication → Sign In / Providers → Phone → ส่วน **Test OTP** · ผูกเบอร์กับรหัสตายตัว ไม่ส่ง SMS จริง |
| Twilio / MessageBird / Vonage | ~1.5–2 บาท/ข้อความ | ตอนเปิดให้ลูกค้าจริง |
| ปิด OTP ชั่วคราว | ฟรี | ❌ **ห้าม** — repo เคยปิดแล้วลืมเปิดคืน (commit `7773801`) |

> เริ่มสมัคร SMS provider + ลงทะเบียน sender ID แต่เนิ่นๆ ฝั่งไทยใช้เวลาอนุมัติ

**ผลข้างเคียงที่ควรรู้:** ทุกคนที่ยืนยัน OTP จะได้แถวใน `auth.users` (ตารางเดียวกับ admin)
ไม่กระทบความปลอดภัย เพราะสิทธิ์ admin มาจากแถวใน `admin_users` ไม่ใช่จาก `auth.users`

#### B. Deploy ขึ้น HTTPS ก่อน ถึงจะเปิดใน LINE ได้

LIFF endpoint ต้องเป็น **HTTPS** — `localhost` เปิดในแอป LINE ไม่ได้
→ deploy Vercel ก่อน แล้วเอา URL ไปใส่ LIFF settings (หรือ ngrok ชั่วคราวตอน dev)
→ **env ต้องใส่ใน Vercel ด้วย** ไม่ใช่แค่ `.env.local`

#### C. LINE — เช็คว่าครบหรือยัง

- [ ] **Messaging API เปิดแล้ว** → ได้ `LINE_CHANNEL_ACCESS_TOKEN`
      ⚠️ `env.ts` บังคับตัวนี้ ถ้าไม่มี **แอปไม่ยอม boot เลย** ไม่ใช่แค่ push ไม่ได้
- [ ] LINE Login channel → ได้ `LINE_CHANNEL_ID` (ใช้ verify `aud`)
- [ ] LIFF app สร้างแล้ว · size = Full · endpoint ชี้ไป pilot
- [ ] **Rich Menu** ชี้เข้า LIFF (ไม่งั้นต้องส่งลิงก์กันเองทุกครั้ง)

#### D. Supabase Storage bucket — ยังไม่มีใครสร้าง

`rewards.image_url` ต้องมีที่เก็บรูป แต่ **migration 001–012 ไม่มีอันไหนสร้าง bucket**
→ สร้าง bucket `rewards` แบบ public ใน dashboard เอง (หรือเพิ่มเป็น migration ใน Sprint 9)

#### E. Admin account อย่างน้อย 1 คน

ต้องครบ 3 ส่วน: `auth.users` + แถวใน `admin_users` + ผูก role `super_admin`
[scripts/create-test-admin.js](scripts/create-test-admin.js) มีอยู่แต่เขียนกับ schema เก่า — ต้องเช็ค/แก้ก่อนใช้

#### F. ข้อมูล demo

- รางวัล 5–8 อย่าง **พร้อมรูป** ตั้งราคาแต้มสมจริง (จะได้เห็นว่าอัตราแลกเหมาะไหม)
- `point_settings.baht_per_point` — migration 002 seed แล้ว ✓

#### G. เกี่ยวข้องตอน Sprint 7+

- `NOTIFICATIONS_ENABLED=true` ถึงจะทดสอบ LINE push ได้
- Vercel Cron รันเฉพาะ **production deployment** และแผน Hobby จำกัดวันละครั้ง

---

## 3. สถาปัตยกรรม Phase 1

```
   ┌──────────── Pilot Instance (ใหม่ทั้งหมด) ─────────────┐
   │  Vercel: pilot.hughome.app                            │
   │  Supabase: ฐานเปล่า + schema เป้าหมาย                 │
   │  LINE Provider ใหม่ → Messaging ch. + Login ch./LIFF   │
   │  Telegram bot ทดสอบ · CRON_SECRET ใหม่                │
   └───────────────────────────────────────────────────────┘

   Phase 2 → clone โค้ดชุดเดียวกันไป 2 instance:
     · แม่ริม  (Supabase เดิม + OA เดิม + migration/backfill)
     · ฟ้าฮ่าม (Supabase ใหม่ + OA เดิมของฟ้าฮ่าม)
```

**Flow ที่ต้องทำงานได้จริงใน Phase 1:**
```
[พนักงานขาย] → key Excel (วันที่ซื้อ / เลขที่บิล / เบอร์ / ชื่อ / ยอดซื้อ / ยอดลดหนี้ / พนักงานขาย / หมายเหตุ)
             ⚠️ ไม่มีช่องกรอกตัวคูณ — กันให้ตัวคูณเกินสิทธิ์ (§9.7)
[บัญชี]      → upload .xlsx + เลือกช่วงสัปดาห์ → preview → commit
[Backend]    → normalize เบอร์ (8xx→08xx) → match phone
             → หา campaign ที่คลุม "วันที่ซื้อ" → multiplier (ไม่เจอ = 1)
             → points = ROUND((ซื้อ − ลดหนี้) / baht_per_point × multiplier, 0)
             → เขียน point_batch_ledger (expires_at คิดจาก "เดือนที่ซื้อ" รายแถว)
             → RPC อัปเดต points_balance (row lock) · เตะบิลซ้ำด้วย unique index
             → LINE push แจ้งลูกค้า
[ผู้จัดการ]  → รายงานสัปดาห์ (เทียบเลขที่บิล + ชื่อพนักงานขาย) → สุ่มตรวจ → (ถ้าผิด) void batch ทั้งก้อน
[ลูกค้า]     → /rewards → กดแลก → หัก FIFO จาก ledger → รับที่หน้าร้าน
[Telegram]   ← แจ้งทีมทันที
```

### 3.1 Tenant config

```ts
// src/config/tenant.ts
export const TENANT = {
  code:        process.env.NEXT_PUBLIC_TENANT_CODE!,      // 'pilot' | 'mae_rim' | 'fa_ham'
  name:        process.env.NEXT_PUBLIC_TENANT_NAME!,      // 'ฟ้าฮ่าม'
  segment:     process.env.NEXT_PUBLIC_TENANT_SEGMENT!,   // 'B2B' | 'B2C'
  phone:       process.env.NEXT_PUBLIC_TENANT_PHONE!,
  lineOaId:    process.env.NEXT_PUBLIC_TENANT_LINE_OA!,
  facebookUrl: process.env.NEXT_PUBLIC_TENANT_FB_URL!,
} as const
```
เตรียมไว้ตั้งแต่ Phase 1 เพื่อให้ Phase 2 แค่เปลี่ยน env ไม่ต้องแก้ code

> ⚠️ **ต้องลบ hardcoded LIFF fallback** ที่ [src/app/page.tsx](src/app/page.tsx):
> `liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID || "2000719050-rGVOBePm" })`
> ค่า fallback นี้เป็น LIFF ของระบบ production เดิม — ถ้า env ไม่ครบใน pilot จะเด้งไป**ระบบจริงของแม่ริม**เงียบๆ ทันที
> **เปลี่ยนเป็น throw ถ้า env ไม่มี** — เป็นงานชิ้นแรกที่ต้องทำ

---

## 4. Data Model (สร้างตรงเป็นรูปเป้าหมายเลย)

Phase 1 ไม่มีข้อมูลเดิม → **ไม่ต้องมี `receipts` / `receipt_images` ในฐานใหม่เลย** และไม่ต้องมี column ที่ deprecated

### 4.1 Table ที่ยกมาจากระบบเดิม (ปรับแล้ว)

`user_profiles` · `point_settings` · `point_transactions` · `rewards` · `redemptions` · `tags` · `user_tags` · `user_notes` · `admin_users` · `admin_roles` · `admin_permissions` · `admin_role_permissions` · `admin_user_roles`

**ต่างจากเดิม:**
```sql
-- user_profiles
birthday date NOT NULL,                    -- บังคับตั้งแต่แรก
-- ตัด: points_expire_at (ใช้ ledger แทน), total_receipts, is_admin

-- point_transactions
source          text NOT NULL,             -- 'batch'|'redemption'|'expiry'|'manual'
source_batch_id uuid REFERENCES point_batches(id),
-- transaction_type enum เดิมใช้ต่อได้: earned|spent|expired|bonus|refund

-- redemptions
status redemption_status NOT NULL,         -- enum ใหม่ (ดู 4.3)
pickup_code  text,
delivered_at timestamptz,
delivered_by uuid REFERENCES admin_users(id),
-- ตัด: shipping_address, tracking_number (รับหน้าร้านเท่านั้น)
```

### 4.2 Table ใหม่

#### `point_campaigns` (แทน `promo_codes` — migration 014/015)
> **ตัดสินใจ (27 ก.ค. 2026):** เลิกใช้โค้ดโปรโมชันที่พนักงานขายกรอกในไฟล์ Excel
> เพราะพนักงานที่กรอกยอดเองแล้วกรอกตัวคูณเองด้วย = ให้ตัวคูณเกินสิทธิ์ให้ลูกค้าตัวเองได้
> → ตัวคูณผูก **ช่วงวันที่** ตั้งจากหลังบ้านเท่านั้น ระบบจับคู่จาก `purchase_date` ของแต่ละแถวให้เอง
> `promo_codes` ถูก `DROP` ใน 015 (ยังไม่เคยเปิดใช้ใน pilot — ไม่มีข้อมูลจริง)

```sql
CREATE TABLE point_campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  multiplier  numeric(4,2) NOT NULL CHECK (multiplier > 0),
  starts_on   date NOT NULL,                -- inclusive
  ends_on     date NOT NULL,                -- inclusive
  is_active   boolean NOT NULL DEFAULT true, -- soft-delete (ledger อ้างอยู่)
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

-- ห้ามซ้อนช่วง → แต่ละวันมี multiplier ได้ค่าเดียว → เลือก campaign แบบ deterministic
-- ไม่ต้องมีกฎ tie-break (จุดที่คนเถียงกันเรื่องแต้มภายหลัง)
ALTER TABLE point_campaigns
  ADD CONSTRAINT point_campaigns_no_overlap
  EXCLUDE USING gist ((daterange(starts_on, ends_on, '[]')) WITH &&)
  WHERE (is_active);
```

#### `sales_reps` (migration 013)
> รายชื่อพนักงานขายที่โผล่ใน dropdown ของไฟล์ Excel
> **ไม่ใช้ `admin_users`** เพราะ `auth_user_id` เป็น `UNIQUE NOT NULL` = ต้องเปิด Supabase auth
> account ให้ทุกคน ซึ่งขัด §13 (พนักงานขายไม่ล็อกอินระบบเลย กรอก Excel เท่านั้น)
> **ชื่อ `sales_reps` ไม่ใช่ `sales_staff`** เพราะ `'sales_staff'` ถูกใช้เป็น `admin_roles.name` ไปแล้วใน 012

```sql
CREATE TABLE sales_reps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL,                 -- กุญแจจับคู่จากไฟล์ Excel (label = "CODE · ชื่อ")
  full_name  text NOT NULL,
  phone      text,
  is_active  boolean NOT NULL DEFAULT true,  -- ลาออก = ปิด is_active (ห้ามลบ ledger อ้างอยู่)
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- จำกัดชุดอักขระให้ code ไม่มีทางมีตัวคั่น ' · ' อยู่ข้างใน → invariant ของ parser ถูกบังคับที่ DB
  CHECK (code ~ '^[A-Za-z0-9_-]{1,16}$')
);
CREATE UNIQUE INDEX sales_reps_code_upper_idx ON sales_reps (upper(code));
```

#### `point_batches`
```sql
CREATE TYPE batch_status AS ENUM ('draft','previewed','committed','voided');

CREATE TABLE point_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by     uuid NOT NULL REFERENCES admin_users(id),
  file_name       text NOT NULL,
  file_sha256     text NOT NULL,
  week_start      date NOT NULL,
  week_end        date NOT NULL,
  status          batch_status NOT NULL DEFAULT 'draft',
  total_rows      integer NOT NULL DEFAULT 0,
  valid_rows      integer NOT NULL DEFAULT 0,
  invalid_rows    integer NOT NULL DEFAULT 0,
  unmatched_rows  integer NOT NULL DEFAULT 0,
  total_points    integer NOT NULL DEFAULT 0,
  raw_rows        jsonb   NOT NULL DEFAULT '[]',
  committed_at    timestamptz,
  committed_by    uuid REFERENCES admin_users(id) ON DELETE RESTRICT,  -- 019: ใครกดให้แต้มเข้า
  reviewed_by     uuid REFERENCES admin_users(id),
  reviewed_at     timestamptz,
  review_note     text,
  voided_by       uuid REFERENCES admin_users(id),
  voided_at       timestamptz,
  void_reason     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX point_batches_file_hash_idx
  ON point_batches (file_sha256) WHERE status <> 'voided';

-- committed_at กับ committed_by ต้องมาคู่กัน (019) — มีเวลาแต่ไม่มีคน = audit trail ไม่ครบ
ALTER TABLE point_batches ADD CONSTRAINT point_batches_commit_actor CHECK (
  (committed_at IS NULL AND committed_by IS NULL)
  OR (committed_at IS NOT NULL AND committed_by IS NOT NULL)
);
```
> **4 actor ต่อ batch** — `uploaded_by` (ใครส่งไฟล์) · `committed_by` (ใครกดให้แต้มเข้า) ·
> `reviewed_by` (ใครสุ่มตรวจ) · `voided_by` (ใครยกเลิก) · ทั้ง 4 คนละคนได้ และต้องโชว์ในหน้า
> `/admin/batches` ทุกช่อง (เพิ่ม 27 ก.ค. 2026 — เดิมมี `committed_at` โดยไม่มีคน)

#### `point_batch_ledger` — หัวใจของ step-wise expiry
```sql
CREATE TABLE point_batch_ledger (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES user_profiles(id),
  source_batch_id  uuid REFERENCES point_batches(id),
  source           text NOT NULL DEFAULT 'batch',
  points_earned    integer NOT NULL CHECK (points_earned > 0),
  points_remaining integer NOT NULL CHECK (points_remaining >= 0),
  earned_month     date NOT NULL,        -- วันที่ 1 ของเดือน "ที่ซื้อ" (ไม่ใช่เดือนที่ commit)
  expires_at       date NOT NULL,        -- (วันสุดท้ายของ earned_month) + 365 วัน
  gross_amount     numeric(12,2),
  discount_amount  numeric(12,2),
  net_amount       numeric(12,2),
  multiplier       numeric(4,2) NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- --- เพิ่มใน 015: สาวกลับได้ ---
  purchase_date    date,                 -- วันที่ซื้อจริงต่อแถว → กำหนด earned_month/expires_at
  bill_no          text,                 -- เลขที่บิลตามเอกสารจริง
  sales_rep_id     uuid REFERENCES sales_reps(id)      ON DELETE RESTRICT,
  campaign_id      uuid REFERENCES point_campaigns(id) ON DELETE RESTRICT,
  voided           boolean NOT NULL DEFAULT false,     -- ตั้งโดย void_batch → ปลดล็อกเลขบิล
  CHECK (points_remaining <= points_earned),
  -- แถวจาก batch ต้องสาวกลับได้ครบ · แถวจาก adjust_points_manual ไม่มีบิล/พนักงานตามธรรมชาติ
  CHECK (source <> 'batch' OR (purchase_date IS NOT NULL AND bill_no IS NOT NULL AND sales_rep_id IS NOT NULL))
);
CREATE INDEX pbl_fifo_idx   ON point_batch_ledger (user_id, expires_at) WHERE points_remaining > 0;
CREATE INDEX pbl_expiry_idx ON point_batch_ledger (expires_at)          WHERE points_remaining > 0;

-- 🔒 เลขบิลเดียวขอแต้มได้ครั้งเดียวทั้งระบบ (ข้าม batch ข้ามลูกค้า)
-- batch ที่ถูก void → voided=true ทุกแถว → เลขบิลกลับมาคีย์ใหม่ได้ (แก้ไฟล์ผิดแล้วส่งซ้ำ)
CREATE UNIQUE INDEX pbl_bill_no_active_idx ON point_batch_ledger (upper(btrim(bill_no)))
  WHERE bill_no IS NOT NULL AND NOT voided;
CREATE INDEX pbl_purchase_date_idx ON point_batch_ledger (purchase_date);
CREATE INDEX pbl_sales_rep_idx     ON point_batch_ledger (sales_rep_id, purchase_date);
```
> **Invariant:** `user_profiles.points_balance == SUM(points_remaining)` → cron reconcile รายวัน (§9.2)
>
> **`earned_month` ยึดวันที่ซื้อ ไม่ใช่วันที่ commit** (ตัดสินใจ 27 ก.ค. 2026) — เดิม RPC ใช้ `now()`
> ทั้ง batch ถ้าบัญชีอัปโหลดคาบเดือน ลูกค้าที่ซื้อสิ้นเดือนจะได้อายุแต้มยาวขึ้นฟรี 1 เดือน

#### `notification_channels`
```sql
CREATE TABLE notification_channels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL CHECK (type IN ('telegram','line_group')),
  token      text,
  target_id  text NOT NULL,
  events     text[] NOT NULL DEFAULT ARRAY['redemption.created'],
  is_active  boolean NOT NULL DEFAULT true,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

#### `line_quota_cache`
```sql
CREATE TABLE line_quota_cache (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  quota_limit integer,
  consumed    integer,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
```

### 4.3 Enums
```sql
CREATE TYPE redemption_status AS ENUM
  ('requested','approved','ready','delivered','cancelled');   -- สร้างตรงรูปเป้าหมาย
CREATE TYPE transaction_type  AS ENUM
  ('earned','spent','expired','bonus','refund');
CREATE TYPE user_role         AS ENUM ('contractor','homeowner');
CREATE TYPE batch_status      AS ENUM ('draft','previewed','committed','voided');
```
> Phase 1 ได้เปรียบตรงนี้มาก — ไม่ต้องทำ `ALTER TYPE ADD VALUE` + data migrate แบบ 2 ไฟล์แยก tx เหมือน Phase 2

### 4.4 RPC functions
```sql
award_points_from_batch(p_batch_id uuid, p_admin uuid)   -- v3 (migration 020) · เดิม 1 arg
void_batch(p_batch_id uuid, p_admin uuid, p_reason text)
redeem_reward(p_user uuid, p_reward uuid, p_qty int)   -- lock + FIFO + ตัดสต็อก
expire_ledger_batches(p_as_of date)
adjust_points_manual(p_user uuid, p_delta int, p_admin uuid, p_note text)
```
ทุกตัว `SELECT ... FOR UPDATE` บน `user_profiles` ก่อนคำนวณ · `SECURITY DEFINER` · revoke จาก `anon`/`authenticated`

> `award_points_from_batch` เปลี่ยน signature ใน 020 → รับ `p_admin` เพื่อบันทึกว่าใครกดให้แต้มเข้า
> (`point_batches.committed_by` + `point_transactions.created_by`) · **ตัว 1 argument ถูก `DROP` ทิ้ง**
> ไม่ทำ overload เพราะ overload คือช่องให้เผลอเรียกตัวที่ไม่บันทึกคน · RPC ตรวจว่า `p_admin`
> เป็น `admin_users` ที่ `is_active` จริง ไม่งั้น RAISE (audit trail ต้องไม่โกหก)

**สูตรแต้ม (Workflow Step 3):**
```
net        = ยอดซื้อ − ยอดลดหนี้
multiplier = point_campaigns ที่ is_active AND วันที่ซื้อ BETWEEN starts_on AND ends_on
             (ห้ามซ้อนช่วง → เจอได้ไม่เกิน 1 ตัว · ไม่เจอ = 1)
points     = ROUND(net / point_settings.baht_per_point × multiplier, 0)
```
> RPC ตรวจซ้ำตอน commit ว่า `multiplier` ใน `raw_rows` ตรงกับ campaign จริง — ไม่ตรงคือ RAISE ทั้ง batch
**FIFO ตอนแลก:** ไล่หัก ledger เรียง `expires_at ASC` เฉพาะ `points_remaining > 0 AND expires_at >= today`

---

## 5. Migration (Phase 1 — ฐานเปล่า)

ตั้ง `supabase/migrations/` (ยังไม่มีในโปรเจกต์เลย) แล้วสร้างจาก 0

| ลำดับ | ไฟล์ | หมายเหตุ |
|-------|------|----------|
| 001 | `init_enums.sql` | 4 enums ในรูปเป้าหมาย |
| 002 | `init_core_tables.sql` | user_profiles, point_settings, point_transactions, tags, user_tags, user_notes |
| 003 | `init_admin_rbac.sql` | 5 ตาราง RBAC |
| 004 | `init_rewards_redemptions.sql` | |
| 005 | `create_promo_codes.sql` | ⚠️ ถูก `DROP` ใน 015 — คงไฟล์ไว้เพื่อไม่แก้ประวัติที่ apply ขึ้น pilot ไปแล้ว |
| 006 | `create_point_batches.sql` | |
| 007 | `create_point_batch_ledger.sql` | |
| 008 | `create_notification_channels.sql` | |
| 009 | `create_line_quota_cache.sql` | |
| 010 | `rpc_points_functions.sql` | |
| 011 | `rls_policies.sql` | |
| 012 | `seed_permissions_roles.sql` | |
| — | **↓ pre-Sprint 4 (27 ก.ค. 2026) — เพิ่ม 3 คอลัมน์ในไฟล์ Excel + ย้าย promo → campaign** ↓ | |
| 013 | `create_sales_reps.sql` | รายชื่อพนักงานขาย (ป้อน dropdown) |
| 014 | `create_point_campaigns.sql` | ตัวคูณผูกช่วงวันที่ + `EXCLUDE` ห้ามซ้อนช่วง |
| 015 | `batch_ledger_traceability.sql` | +`purchase_date`/`bill_no`/`sales_rep_id`/`campaign_id`/`voided` · unique bill_no · `DROP TABLE promo_codes` |
| 016 | `rls_new_tables.sql` | enable RLS สองตารางใหม่ |
| 017 | `rpc_points_functions_v2.sql` | `award_points_from_batch` + `void_batch` เวอร์ชันใหม่ (`earned_month` จาก `purchase_date`) |
| 018 | `permissions_campaigns_salesreps.sql` | `promos.*` → `campaigns.*` + `salesreps.*` (รวม 29 permissions) |
| 019 | `batch_committed_by.sql` | `point_batches.committed_by` + CHECK คู่กับ `committed_at` |
| 020 | `rpc_award_v3_commit_actor.sql` | `award_points_from_batch(id, admin)` — บันทึกคน commit · DROP ตัว 1 arg |
| seed | `supabase/seed/seed_demo_data.sql` | **Sprint 9 · รันด้วยมือ ห้ามอยู่ใน migration path · ห้ามรันใน Phase 2** |

**20 ไฟล์ migration** — 001–012 เป็นการสร้างจาก 0 (ไม่มี alter/backfill) · 013–020 เป็น alter
เพราะ 001–012 apply ขึ้น Supabase pilot ไปแล้ว **จึงห้ามแก้ไฟล์เก่าย้อนหลัง**

> ผลข้างเคียงที่ยอมรับ: DB ใหม่ (Phase 2) จะ `CREATE promo_codes` ใน 005 แล้ว `DROP` ใน 015
> เป็น noise แต่รักษาความจริงของประวัติ migration ไว้ — ถ้าจะ squash ให้ทำตอนขึ้น Phase 2 พร้อมกันทีเดียว

**กติกา:** ห้ามแก้ schema ผ่าน Supabase dashboard เด็ดขาด (สาเหตุอันดับหนึ่งของ drift ตอนขึ้น Phase 2)

---

## 6. API

### 6.1 User-side
| Method | Path | หมายเหตุ |
|--------|------|----------|
| POST | `/api/liff/login` | **JWKS verify จริง** — signature + `iss` + `aud === LINE_CHANNEL_ID` + `exp` |
| POST | `/api/onboarding` | บังคับ `birthday` · ไม่รับ `line_user_id` จาก body |
| GET | `/api/user/me` | profile + `points_balance` + `next_expiry { points, expires_at }` |
| GET | `/api/rewards` | |
| POST | `/api/rewards/redeem` | auth guard · เรียก RPC · trigger notify |
| ~~receipts / upload / history~~ | | **ไม่มีในระบบใหม่** |

### 6.2 Admin-side
```
POST   /api/admin/batches/upload       multipart .xlsx → parse + dry-run → preview
                                       body: { week_start, week_end }
                                       resp: { batch_id, summary{total,valid,invalid,unmatched},
                                               rows[{row_no,purchase_date,bill_no,phone,name,
                                                     gross,discount,net,sales_rep,campaign,
                                                     multiplier,points,status,error}] }
POST   /api/admin/batches/:id/commit   → RPC award_points_from_batch(id, admin_id) + LINE push
                                       admin_id มาจาก session เท่านั้น ห้ามรับจาก body
GET    /api/admin/batches              list + filter week/status
                                       resp ต้องมีชื่อ actor ทั้ง 4: uploaded_by / committed_by /
                                       reviewed_by / voided_by (join admin_users → full_name, email)
GET    /api/admin/batches/:id          รายละเอียด + rows + actor ทั้ง 4 พร้อม timestamp
POST   /api/admin/batches/:id/review   ผู้จัดการบันทึกผลสุ่มตรวจ
POST   /api/admin/batches/:id/void     → RPC void_batch
GET    /api/admin/batches/template     ดาวน์โหลด Excel template
                                       ⚠️ generate สด — dropdown ต้องมาจาก sales_reps ที่ is_active
                                          ตอนนั้น (ห้าม serve ไฟล์ static)

GET/POST/PATCH/DELETE  /api/admin/campaigns[/:id]   ตัวคูณผูกช่วงวันที่ (permission campaigns.manage)
GET/POST/PATCH/DELETE  /api/admin/sales-reps[/:id]  รายชื่อพนักงานขาย (permission salesreps.manage)
GET/POST/PATCH         /api/admin/notifications[/:id]
POST   /api/admin/notifications/:id/test

GET    /api/admin/reports/weekly       column: เลขที่บิล + พนักงานขาย + วันที่ซื้อ (ต้องมี — ใช้สุ่มตรวจ
                                       เทียบเอกสารจริง §9.7) · มี column สาขาจาก TENANT
GET    /api/admin/quota                LINE quota (cache 15 นาที)
PATCH  /api/admin/redemptions/:id/status   approved|ready|delivered
POST   /api/admin/redemptions/:id/cancel   คืนแต้ม+สต็อก · ห้ามถ้า delivered
```

### 6.3 Cron
| Path | Schedule |
|------|----------|
| `/api/cron/expire-points-monthly` | `0 1 1 * *` |
| `/api/cron/points-expiry-warning` | `0 2 1 * *` — เตือนล่วงหน้า **1–3 เดือน** |
| `/api/cron/birthday-greetings` | `0 2 * * *` |
| `/api/cron/reconcile-balances` | `0 3 * * *` |

---

## 7. RBAC

### Permissions
```
dashboard.view
users.view / edit / manage_points / manage_notes / manage_tags
tags.view / manage
rewards.view / create / edit / delete
redemptions.view / process / deliver
batches.view / upload / commit / review / void
campaigns.view / manage    ← แทน promos.* (migration 018)
salesreps.view / manage    ← ใหม่ (migration 018)
notifications.manage
reports.view
settings.edit
admins.manage
sales.entry              ← เผื่ออนาคต ยังไม่มี UI
```
> **ไม่มี `receipts.*` เลยในระบบใหม่** — ต้องแก้ `PERMISSIONS` const ที่ [src/types/admin.ts:112](src/types/admin.ts#L112)

### Roles
| role | display | permissions |
|------|---------|-------------|
| `super_admin` | Super Admin | ทุกอย่าง (bypass ใน [admin-auth.ts](src/lib/admin-auth.ts)) |
| `manager` | ผู้จัดการ | `dashboard.view`, `reports.view`, `batches.view/review/void`, `redemptions.*`, `users.view`, `campaigns.view`, `salesreps.view` |
| `accounting` | บัญชี | `batches.view/upload/commit`, `campaigns.view`, `salesreps.view/manage`, `users.view` — **ตั้งตัวคูณ campaign ไม่ได้** (§9.7 แยกหน้าที่) |
| `sales_staff` | พนักงานขาย | `sales.entry`, `users.view` |
| `reward_manager` | Reward Manager | `rewards.*`, `redemptions.view/process/deliver` |
| `customer_support` | Customer Support | `users.view/edit/manage_notes`, `redemptions.view` |

---

## 8. Frontend

### 8.1 User-side
| หน้า | สถานะ |
|------|-------|
| [/dashboard](src/app/dashboard/page.tsx) | **แก้** — ลบ `UploadSection` + `ReceiptCamera` + `ReceiptUploadResult` · เพิ่มการ์ด "แต้ม X หมดอายุ [เดือน]" |
| [/onboarding](src/app/onboarding/page.tsx) | **แก้** — `birthday` required |
| [/rewards](src/app/rewards/page.tsx) | **แก้** — "รับที่หน้าร้าน{TENANT.name}เท่านั้น" |
| `/call` | **ใหม่** — เบอร์ 2 สาขา + LINE OA (ตาม `renderCall()` ใน mockup v7) |
| `/facebook` | **ใหม่** |
| ~~/history~~ | **ลบ** |
| [BottomNavigation](src/components/BottomNavigation.tsx) | **แก้** — 5 tabs: หน้าหลัก · แลกรางวัล · โทรร้าน · Facebook · โปรไฟล์ |

### 8.2 Admin-side
| หน้า | สถานะ |
|------|-------|
| [/admin](src/app/admin/page.tsx) | **แก้** — แบนเนอร์สาขา · widget LINE quota · ลบ `ReceiptStatusChart` + `RecentReceiptsTable` |
| `/admin/batches` | **ใหม่** — list + upload + preview + commit + void + ปุ่มโหลด template · **ทุกแถวโชว์ชื่อบัญชีที่อัปโหลด + บัญชีที่กด commit (ให้แต้มเข้า) + ผู้สุ่มตรวจ + ผู้ยกเลิก** พร้อมวันเวลา |
| `/admin/campaigns` | **ใหม่** — ช่วงวันที่ + ตัวคูณ · UI ต้องกันช่วงซ้อน (DB กันอยู่แล้ว แต่ error ต้องอ่านรู้เรื่อง) |
| `/admin/sales-reps` | **ใหม่** — เพิ่ม/ปิดพนักงานขาย (ปิด is_active ไม่ใช่ลบ) |
| `/admin/notifications` | **ใหม่** |
| [/admin/redemptions](src/app/admin/redemptions/page.tsx) | **แก้** — 4 statuses + สแกน QR |
| [/admin/reports](src/app/admin/reports/page.tsx) | **แก้** — weekly view · **มี column เลขที่บิล + พนักงานขาย** (แก้ 27 ก.ค. 2026 — เดิมเขียนว่าลบ แต่สุ่มตรวจต้องเทียบบิลได้) |
| [/admin/roles](src/app/admin/roles/page.tsx) | **แก้** — permission keys ใหม่ (`campaigns.*`, `salesreps.*`) |
| [/admin/layout.tsx](src/app/admin/layout.tsx) | **แก้** — sidebar `TENANT.name` · เมนู Batch/Campaign/พนักงานขาย/Notifications |
| ~~/admin/receipts~~ · ~~/admin/receipts/upload~~ | **ลบ** |

### 8.3 ไฟล์ที่ต้องลบ
`src/lib/gemini-ocr.ts` · `src/hooks/useReceiptUpload.ts` · `useReceipts.ts` · `useReceiptActions.ts` · `src/components/ReceiptCamera.tsx` · `ReceiptUploadResult.tsx` · `src/components/admin/{Approve,Reject,Edit,OcrConfirm,ReceiptDetail,ReceiptImage}*.tsx` · `src/components/admin/receipts/` · `src/types/receipt.ts` · `src/utils/receiptHelpers.tsx` · `src/app/api/receipts/` · `src/app/api/admin/receipts/` · `src/app/api/upload/` · `src/app/history/`

**รวม ~56 ไฟล์ที่มี reference ถึง receipt/OCR** ต้องกวาดให้หมด — เกณฑ์ผ่านคือ `npx tsc --noEmit` สะอาด

---

## 9. ความเสี่ยง (Phase 1)

### 9.1 LIFF fallback ชี้ไป production เดิม ⚠️ อันตรายที่สุดตอนนี้
[src/app/page.tsx](src/app/page.tsx) มี LIFF ID ของระบบจริง hardcode เป็น fallback — ถ้า env ของ pilot ไม่ครบ ผู้ทดสอบจะถูกส่งเข้า**ระบบจริงของแม่ริม** โดยไม่มีอะไรเตือน
→ **ลบ fallback + throw ถ้า env ไม่มี เป็นงานชิ้นแรกสุด**
→ เพิ่ม startup validation เทียบ `TENANT.code` กับค่าใน DB · ไม่ตรง = refuse to boot

### 9.2 Reconciliation
`points_balance` vs `SUM(ledger.points_remaining)` หลุดกันได้ทุกจุดที่มี bug → cron รายวัน · ไม่ตรงให้ alert เข้า Telegram · **อย่า auto-fix เงียบๆ**

### 9.3 Excel parsing security
`xlsx@0.18.5` มี prototype pollution + ReDoS · ตอนนี้ใช้แค่ *เขียน* report แต่ Phase 1 จะเริ่ม *อ่าน* ไฟล์อัปโหลด
→ เปลี่ยนเป็น `exceljs` ✅ (27 ก.ค. 2026 · ถอน `xlsx` ออกจาก dependencies แล้ว)
· จำกัดขนาดไฟล์ 5 MB + 5,000 row (`src/lib/excel/sales-columns.json` → `limits`) · reject formula cells · ไม่ trust ชื่อ sheet

> ⚠️ `exceljs` ลาก advisory ของตัวเองมาด้วย: `archiver → glob → minimatch → brace-expansion` (DoS)
> และ `uuid` v3/v5/v6 (buffer bounds) — ทั้งสองอยู่ในเส้นทาง *เขียน* zip ไม่ใช่ *อ่าน* ไฟล์ที่ผู้ใช้อัปโหลด
> ซึ่งเป็นช่องที่เรากลัว แต่ไม่ใช่ว่า "ปลอด vuln" · ทบทวนตอน Sprint 9

### 9.7 กันทุจริตฝั่งพนักงานขาย (เพิ่ม 27 ก.ค. 2026)
พนักงานขายเป็นคนกรอกยอดเอง → ต้องมีของกันไว้ 4 ชั้น

| กลไก | กันอะไร | บังคับที่ไหน |
|---|---|---|
| ไม่มีคอลัมน์ Promo Code | ให้ตัวคูณเกินสิทธิ์ตัวเอง | ไม่มีช่องให้กรอก + ตัวคูณมาจาก `point_campaigns` ตาม `purchase_date` |
| `bill_no` unique (ไม่นับที่ voided) | คีย์บิลเดิมซ้ำเอาแต้มสองรอบ | `pbl_bill_no_active_idx` (DB) |
| `sales_rep_id` บังคับ + dropdown | สาวไม่ได้ว่าแถวไหนใครคีย์ | `pbl_batch_traceability` CHECK + data validation ในไฟล์ |
| `purchase_date` ต้องอยู่ใน `week_start..week_end` | ยัดยอดข้ามสัปดาห์/ย้อนอดีต | RPC `award_points_from_batch` RAISE + parser reject ที่ preview |

RPC ยังตรวจซ้ำว่า `multiplier` ใน `raw_rows` ตรงกับ campaign ที่ active และคลุม `purchase_date` จริง
ถ้าไม่ตรง → RAISE ทั้ง batch (ยอมให้ล้มดัง ดีกว่าปล่อยแต้มผิดตัวคูณเข้าบัญชีลูกค้า)

**แยกหน้าที่:** `accounting` (คนอัปโหลด) จัดการ `sales_reps` ได้ แต่ตั้ง `campaigns` ไม่ได้ ·
`manager` (คนสุ่มตรวจ) ดูได้ทั้งคู่ แต่แก้ไม่ได้ — คนคีย์ยอดต้องไม่ใช่คนตั้งตัวคูณ

**ใครอัปโหลด — ตัดสินใจแล้ว (27 ก.ค. 2026): `accounting` เท่านั้น**
พนักงานขายกรอก Excel → ส่งไฟล์ให้บัญชี (LINE/อีเมล) → บัญชีอัปโหลด · **พนักงานขายไม่มี login เข้าระบบ**
- เหตุผล: `point_batches.uploaded_by` เป็น FK → `admin_users` ซึ่ง `auth_user_id` เป็น `UNIQUE NOT NULL`
  ถ้าให้พนักงานขายอัปโหลดเอง = ต้องเปิด Supabase auth account ให้ทุกคน + ขัด §13 Non-Goals
  + ต้องผูก `sales_reps` กับ `admin_users` ทั้งชุด · ไม่คุ้มกับที่ได้
- ห้ามสร้างหน้า/endpoint ให้พนักงานขาย login หรืออัปโหลดใน Phase 1

> **ทางอัปเกรดถ้าเปลี่ยนใจภายหลัง** (ไม่ต้องรื้อของที่ทำไปแล้ว): ให้พนักงานขายมี account +
> permission `batches.upload` แต่ **ไม่ให้** `batches.commit` → อัปโหลดได้ เห็น preview ของตัวเอง
> แต่แต้มยังไม่เข้าจนบัญชีกด commit · ทำได้เพราะ `uploaded_by` กับ `committed_by` แยกกันแล้ว (019/020)

### 9.4b 🔴 OTP ยืนยันแล้วไม่ผูกกับอะไร — **ค้างจาก Sprint 2 ต้องแก้ใน Sprint 3**

flow ปัจจุบัน: `send-otp` → `verify-otp` → client → `onboarding`
แต่ [verify-otp](src/app/api/phone/verify-otp/route.ts) คืนแค่ `{success:true}` **ไม่บันทึกอะไรฝั่ง server**
และ [onboarding](src/app/api/onboarding/route.ts) รับ `phone` จาก body ตรงๆ โดยไม่ตรวจว่าผ่าน OTP มาจริง

→ **ยิง `/api/onboarding` ตรงๆ พร้อมเบอร์ของคนอื่นได้ โดยไม่ต้องผ่าน OTP เลย**

**ทำไมหนักกว่าที่คิด:** เบอร์โทรคือกุญแจของระบบแต้มทั้งระบบ — พนักงานขาย key เบอร์ลง Excel →
batch upload จับคู่ด้วยเบอร์ → แต้มเข้าโปรไฟล์ที่ถือเบอร์นั้น
ถ้าใครสมัครทับเบอร์คนอื่นไว้ก่อน **แต้มจะวิ่งเข้าคนผิด**
(มี unique constraint บน `phone` อยู่ จำกัดความเสียหายไว้ที่ "ใครมาก่อนได้ก่อน" แต่ยังเป็นช่อง)

**วิธีแก้ที่เข้ากับดีไซน์เดิมที่สุด:** ให้ `verify-otp` ออก session cookie ใหม่ที่มี `verified_phone`
แล้ว `onboarding` เช็ค `body.phone === session.verified_phone` — ใช้กลไก session ที่มีอยู่แล้ว ไม่ต้องเพิ่มตาราง

### 9.4 OTP ต้องไม่มี bypass
repo นี้เคยมีประวัติ comment OTP ทิ้งชั่วคราว (commit `7773801` แล้วเปิดคืนที่ `7c05ee0`) — ระวังไม่ให้เกิดซ้ำ โดยเฉพาะช่วง demo ที่อยากให้ทดสอบง่าย
→ ถ้าจำเป็นต้องข้ามตอน demo ให้ทำผ่าน **env flag ที่ default = off** และเช็คว่าปิดแน่นอนก่อนขึ้น Phase 2

### 9.5 Telegram bot token
credential เต็มรูปแบบ → encrypted at rest · API GET ต้อง mask · ห้ามเข้า client bundle · ห้าม log

### 9.6 Demo data ปนเข้า production
`seed_demo_data.sql` ต้องแยกไฟล์ชัดเจนและไม่อยู่ใน migration path ปกติ → ตั้งชื่อ/โฟลเดอร์ให้รันด้วยมือเท่านั้น

---

## 10. Sprint Plan — Phase 1

| Sprint | งาน | Gate |
|--------|-----|------|
| **0** ✅ | tenant config · env validation · **ลบ LIFF fallback** (เจอ 2 จุด) · `supabase/migrations/` · `.env.example` | ผ่าน |
| **1** ✅ | Schema 001–012 + rollback ครบ + RPC + RLS deny-by-default + seed 27 permissions/6 roles | ผ่าน |
| **2** ✅ | JWKS verify ครบ 4 เงื่อนไข · httpOnly session · middleware · auth guard ทุก user API · tenant-guard | ผ่าน — **เหลือค้าง §9.4b (OTP ไม่ผูกกับ onboarding)** |
| **3** ⏳ | กวาด OCR/Receipt (~56 ไฟล์) + **แก้ §9.4b** + ปรับ user flow ให้เหลือ login/onboarding/dashboard/rewards | `tsc --noEmit` สะอาด · ไม่มี dead import · **ยิง onboarding ด้วยเบอร์ที่ไม่ผ่าน OTP ต้องถูกปฏิเสธ** · ← **จุดที่เริ่มให้ทดลองเล่นได้** |
| **3.5** ✅ | **pre-Sprint 4** (27 ก.ค. 2026) — column spec 8 คอลัมน์ · `xlsx`→`exceljs` · migration 013–018 (`sales_reps`, `point_campaigns`, ledger traceability, RPC v2) | SQL parse ผ่าน · `tsc` สะอาด · **ยังไม่ apply ขึ้น Supabase** |
| **4–5** | **Excel Batch Upload** — parser, validation, preview, commit, void + `/admin/batches` + `/admin/sales-reps` | upload ไฟล์จริงจากบัญชี → แต้มเข้าถูก → void คืนได้ · บิลซ้ำถูกเตะ |
| **6** | **Campaign** (ตัวคูณผูกช่วงวันที่) + `/admin/campaigns` + ผูกเข้าสูตรคำนวณ | multiplier ถูกทุกเคส · ตั้งช่วงซ้อนกันต้องถูก DB ปฏิเสธ |
| **7** | Step-wise expiry + cron + LINE push (แต้มเข้า/เตือนหมดอายุ/วันเกิด) + LINE quota | push ถึงจริง · FIFO หักถูกลำดับ |
| **8** | Telegram/LINE group notify + redemption 4 statuses + QR | กดแลก → เด้งเข้ากลุ่มภายใน 5 วิ |
| **9** | User UI (bottom nav, /call, /facebook) + Admin polish + reports + **seed demo data** | ตรงกับ mockup v7 · ลูกค้าเล่นได้ครบ flow |

**~9 sprints** — แต่แต่ละ sprint เบากว่า v2 มาก เพราะไม่มี backfill, ไม่มี dual-deploy, ไม่มีข้อมูลจริงให้กลัว

**Milestone ที่ลูกค้าเห็นของได้:**
- จบ Sprint 3 → login + ดูแต้ม + แลกของ ได้ (แต้มยังใส่มือ)
- จบ Sprint 5 → **flow หลักครบ** upload Excel → แต้มเข้า → แลกของ ← *จุดที่ควรให้ลูกค้าเริ่มทดลองเล่น*
- จบ Sprint 9 → ครบตาม mockup

---

## 11. Phase 2 — ย้าย production (ร่างไว้ก่อน)

งานที่ยกมาจาก v2 ทั้งหมดที่ Phase 1 ไม่ต้องทำ:

1. **Clone โค้ด pilot → 2 instance** (แม่ริม + ฟ้าฮ่าม) เปลี่ยนแค่ env
2. **แม่ริม: migrate ฐานเดิม** — alter schema จากรูปเดิม → รูปเป้าหมาย (enum `ALTER TYPE ADD VALUE` แยก tx · alter table · deprecate column)
3. **Backfill ledger จาก `points_balance`** ⚠️ เสี่ยงสูงสุดของทั้งโปรเจกต์ — สร้าง ledger row เดียวต่อ user (`source='legacy'`) ใช้ `points_expire_at` เดิมเป็น `expires_at` · dry-run เทียบยอดรวมต้องเท่าเป๊ะก่อน commit
4. **Backfill `birthday`** — modal บังคับกรอกตอน login จน null เหลือ 0 แล้วค่อย `SET NOT NULL`
5. **Cutover ใบเสร็จ pending** — reject ทั้งหมด + LINE แจ้งวิธีใหม่ · รันหลังปิด upload endpoint
6. **Archive `receipts` / `receipt_images`** — ไม่ลบ เผื่อ audit
7. **ฟ้าฮ่าม: สวมระบบเข้า OA เดิม** — ต้องได้สิทธิ์ LINE Developers Console ของ OA นั้นก่อน (ตัวบล็อกที่แก้ด้วย code ไม่ได้) · เปิด Messaging API · สร้าง Login channel + LIFF · เคลียร์ auto-reply เดิม · ตั้ง Rich Menu · เช็ค plan/quota
8. **Schema drift check ระหว่าง 2 ฐาน** — `supabase db diff` หลัง deploy ทุกครั้ง

---

## 12. ค้างอยู่ / ต้องได้ก่อนเริ่ม

### ✅ เคลียร์แล้ว
1. **Excel Template** — สร้างแล้วที่ [docs/Hughome_Sales_Staff_Template.xlsx](docs/Hughome_Sales_Staff_Template.xlsx) · generator อยู่ที่ [scripts/generate-sales-template.js](scripts/generate-sales-template.js) (รันใหม่ได้เมื่อ spec เปลี่ยน)
2. **Supabase project ใหม่** — สร้างแล้ว
3. **LINE สำหรับ demo** — มีแล้ว (ต้องเช็คว่าเปิด Messaging API + สร้าง Login channel/LIFF ครบหรือยัง — §2.1)

### เลื่อนได้ (ไม่บล็อก Sprint 0–7)
4. **Telegram bot + group** — ใช้จริงที่ Sprint 8 เท่านั้น
5. เบอร์โทร 2 สาขา (mockup เป็น `053-XXX-1234`)
6. Facebook Page URL
7. Domain ของ pilot
8. รายการรางวัลจริงที่จะใช้ demo
9. นโยบายเบอร์ที่ไม่ match ตอน batch upload — แนะนำข้าม + รายงานก่อน

### Column spec ที่ล็อคแล้ว (parser ต้องอ่านให้ตรง)
> **Single source of truth = `src/lib/excel/sales-columns.json`**
> อ่านไฟล์เดียวกันทั้ง `scripts/generate-sales-template.js` (plain JS, `require`) และ parser/API (TS, `resolveJsonModule`)
> ห้ามประกาศหัวตารางซ้ำที่อื่น · ตารางล่างนี้คือสำเนาสำหรับอ่าน ถ้าไม่ตรงกับ JSON → JSON ถูก

แผ่น **"ยอดซื้อ"** · หัวตารางอยู่แถวที่ 1 · **8 คอลัมน์** เรียงตามนี้ (แก้ 27 ก.ค. 2026):

| # | คอลัมน์ | จำเป็น | รูปแบบ |
|---|---------|--------|--------|
| A | `วันที่ซื้อ` | ✅ | เซลล์วันที่ · รับ `dd/mm/yyyy` · แปลง พ.ศ.→ค.ศ. (ปี > 2400 → −543) · ต้องอยู่ใน `week_start..week_end` |
| B | `เลขที่บิล` | ✅ | ข้อความ ≤64 ตัว · **กันซ้ำข้ามทุก batch** (ไม่นับ batch ที่ voided) |
| C | `เบอร์โทรลูกค้า` | ✅ | ข้อความ 10 หลัก · auto-fix `8xx → 08xx` · ต้องขึ้นต้น `0[689]` |
| D | `ชื่อลูกค้า` | | ใช้ตรวจทาน · จับคู่ด้วยเบอร์เท่านั้น |
| E | `ยอดซื้อ` | ✅ | ตัวเลข > 0 |
| F | `ยอดลดหนี้` | | ตัวเลข · ว่าง = 0 · ต้อง ≤ ยอดซื้อ |
| G | `พนักงานขาย` | ✅ | **dropdown** จาก `sales_reps` ที่ active · label = `รหัส · ชื่อ` · parser ตัดส่วนหน้า ` · ` ไป match `upper(code)` |
| H | `หมายเหตุ` | | ไม่ส่งถึงลูกค้า |

**ไม่มีคอลัมน์ Promo Code อีกแล้ว** — ตัวคูณมาจาก `point_campaigns` ตาม `วันที่ซื้อ` (§9.7)

แผ่นที่ 2 ชื่อ **"คำแนะนำ"** — parser ต้อง**ข้าม**แผ่นนี้
แผ่นที่ 3 ชื่อ **`_staff`** (`veryHidden`) — แหล่งข้อมูลของ dropdown · parser ต้อง**ข้าม**เช่นกัน
parser อ่านเฉพาะแผ่น "ยอดซื้อ" และต้อง reject ถ้าเจอแผ่นชื่ออื่นนอกจาก 3 ชื่อนี้

### เลื่อนไป Phase 2
- สิทธิ์เข้า LINE Developers Console ของ OA ฟ้าฮ่ามเดิม
- แผนสื่อสารลูกค้าแม่ริมเรื่องเปลี่ยนวิธีสะสมแต้ม
- admin เดิม 7 คน แต่ละคนอยู่ instance ไหน

---

## 13. Non-Goals

- Web App ให้พนักงานขาย key ทีละรายการ — ใช้ Excel แทน
- Product-level tagging / analytics
- Cross-instance consolidated view แบบ real-time — Export Excel รวมเอง
- โอนแต้มข้ามสาขา
- User-facing point history
- Shipping / จัดส่งของรางวัล (รับหน้าร้านเท่านั้น)
- OCR / Gemini (เก็บ API key เผื่ออนาคต)
