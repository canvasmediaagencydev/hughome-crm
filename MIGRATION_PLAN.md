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
- จัดการ Promo Code
- จัดการรางวัล + คำขอแลก (4 statuses + สแกน QR)
- จัดการผู้ใช้ + Tags
- Roles ใหม่ 3 ระดับ
- ตั้งค่า Telegram/LINE group + ปุ่มทดสอบ
- Dashboard + รายงานสัปดาห์ + export Excel
- ดูโควตา LINE คงเหลือ

**Demo data ที่ต้อง seed** — ลูกค้าตัวอย่าง ~20 คน (มีเบอร์จริงของทีมทดสอบปนอยู่บ้างเพื่อทดสอบ push) · รางวัล ~8 รายการ · promo code 2 ตัว · admin 1 คนต่อ role

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
[พนักงานขาย] → key Excel (เบอร์ / ชื่อ / ยอดซื้อ / ยอดลดหนี้ / Promo / หมายเหตุ)
[บัญชี]      → upload .xlsx → preview → commit
[Backend]    → normalize เบอร์ (8xx→08xx) → match phone
             → points = ROUND((ซื้อ − ลดหนี้) / baht_per_point × multiplier, 0)
             → เขียน point_batch_ledger (มี expires_at ของตัวเอง)
             → RPC อัปเดต points_balance (row lock)
             → LINE push แจ้งลูกค้า
[ผู้จัดการ]  → รายงานสัปดาห์ → สุ่มตรวจ → (ถ้าผิด) void batch ทั้งก้อน
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

#### `promo_codes`
```sql
CREATE TABLE promo_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,
  name         text NOT NULL,
  description  text,
  multiplier   numeric(4,2) NOT NULL CHECK (multiplier > 0),
  starts_at    timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,
  max_uses     integer,
  usage_count  integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES admin_users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);
CREATE UNIQUE INDEX promo_codes_code_upper_idx ON promo_codes (upper(code));
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
```

#### `point_batch_ledger` — หัวใจของ step-wise expiry
```sql
CREATE TABLE point_batch_ledger (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES user_profiles(id),
  source_batch_id  uuid REFERENCES point_batches(id),
  source           text NOT NULL DEFAULT 'batch',
  points_earned    integer NOT NULL CHECK (points_earned > 0),
  points_remaining integer NOT NULL CHECK (points_remaining >= 0),
  earned_month     date NOT NULL,        -- วันที่ 1 ของเดือนที่ได้รับ
  expires_at       date NOT NULL,        -- (วันสุดท้ายของ earned_month) + 365 วัน
  gross_amount     numeric(12,2),
  discount_amount  numeric(12,2),
  net_amount       numeric(12,2),
  promo_code_id    uuid REFERENCES promo_codes(id),
  multiplier       numeric(4,2) NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (points_remaining <= points_earned)
);
CREATE INDEX pbl_fifo_idx   ON point_batch_ledger (user_id, expires_at) WHERE points_remaining > 0;
CREATE INDEX pbl_expiry_idx ON point_batch_ledger (expires_at)          WHERE points_remaining > 0;
```
> **Invariant:** `user_profiles.points_balance == SUM(points_remaining)` → cron reconcile รายวัน (§9.2)

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
award_points_from_batch(p_batch_id uuid)
void_batch(p_batch_id uuid, p_admin uuid, p_reason text)
redeem_reward(p_user uuid, p_reward uuid, p_qty int)   -- lock + FIFO + ตัดสต็อก
expire_ledger_batches(p_as_of date)
adjust_points_manual(p_user uuid, p_delta int, p_admin uuid, p_note text)
```
ทุกตัว `SELECT ... FOR UPDATE` บน `user_profiles` ก่อนคำนวณ · `SECURITY DEFINER` · revoke จาก `anon`/`authenticated`

**สูตรแต้ม (Workflow Step 3):**
```
net    = ยอดซื้อ − ยอดลดหนี้
points = ROUND(net / point_settings.baht_per_point × promo.multiplier, 0)
```
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
| 005 | `create_promo_codes.sql` | |
| 006 | `create_point_batches.sql` | |
| 007 | `create_point_batch_ledger.sql` | |
| 008 | `create_notification_channels.sql` | |
| 009 | `create_line_quota_cache.sql` | |
| 010 | `rpc_points_functions.sql` | |
| 011 | `rls_policies.sql` | |
| 012 | `seed_permissions_roles.sql` | |
| 013 | `seed_demo_data.sql` | **แยกไฟล์ให้ชัด · ห้ามรันใน Phase 2** |

**13 ไฟล์ · ไม่มี alter · ไม่มี backfill · ไม่มี data migrate** — เทียบกับ v2 ที่มี 13 ไฟล์แต่ครึ่งหนึ่งเป็น alter/backfill บนข้อมูลจริง

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
                                               rows[{row_no,phone,name,gross,discount,net,
                                                     promo_code,points,status,error}] }
POST   /api/admin/batches/:id/commit   → RPC award_points_from_batch + LINE push
GET    /api/admin/batches              list + filter week/status
GET    /api/admin/batches/:id          รายละเอียด + rows
POST   /api/admin/batches/:id/review   ผู้จัดการบันทึกผลสุ่มตรวจ
POST   /api/admin/batches/:id/void     → RPC void_batch
GET    /api/admin/batches/template     ดาวน์โหลด Excel template

GET/POST/PATCH/DELETE  /api/admin/promos[/:id]
GET/POST/PATCH         /api/admin/notifications[/:id]
POST   /api/admin/notifications/:id/test

GET    /api/admin/reports/weekly       ไม่มีเลขที่บิล · มี column สาขาจาก TENANT
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
promos.view / manage
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
| `manager` | ผู้จัดการ | `dashboard.view`, `reports.view`, `batches.view/review/void`, `redemptions.*`, `users.view` |
| `accounting` | บัญชี | `batches.view/upload/commit`, `promos.view`, `users.view` |
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
| `/admin/batches` | **ใหม่** — list + upload + preview + commit + void |
| `/admin/promos` | **ใหม่** |
| `/admin/notifications` | **ใหม่** |
| [/admin/redemptions](src/app/admin/redemptions/page.tsx) | **แก้** — 4 statuses + สแกน QR |
| [/admin/reports](src/app/admin/reports/page.tsx) | **แก้** — ลบ column เลขที่บิล · weekly view |
| [/admin/roles](src/app/admin/roles/page.tsx) | **แก้** — permission keys ใหม่ |
| [/admin/layout.tsx](src/app/admin/layout.tsx) | **แก้** — sidebar `TENANT.name` · เมนู Batch/Promo/Notifications |
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
→ เปลี่ยนเป็น `exceljs` · จำกัดขนาดไฟล์ + จำนวน row · reject formula cells · ไม่ trust ชื่อ sheet

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
| **4–5** | **Excel Batch Upload** — parser, validation, preview, commit, void + `/admin/batches` | upload ไฟล์จริงจากบัญชี → แต้มเข้าถูก → void คืนได้ |
| **6** | Promo Code + ผูกเข้าสูตรคำนวณ | multiplier ถูกทุกเคส |
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
แผ่น **"ยอดซื้อ"** · หัวตารางอยู่แถวที่ 1 · 6 คอลัมน์เรียงตามนี้:

| # | คอลัมน์ | จำเป็น | รูปแบบ |
|---|---------|--------|--------|
| A | `เบอร์โทรลูกค้า` | ✅ | ข้อความ 10 หลัก · auto-fix `8xx → 08xx` |
| B | `ชื่อลูกค้า` | | ใช้ตรวจทาน · จับคู่ด้วยเบอร์เท่านั้น |
| C | `ยอดซื้อ` | ✅ | ตัวเลข |
| D | `ยอดลดหนี้` | | ตัวเลข · ว่าง = 0 |
| E | `Promo Code` | | ไม่สนตัวพิมพ์เล็ก/ใหญ่ |
| F | `หมายเหตุ` | | ไม่ส่งถึงลูกค้า |

แผ่นที่ 2 ชื่อ **"คำแนะนำ"** — parser ต้อง**ข้าม**แผ่นนี้ อ่านเฉพาะแผ่น "ยอดซื้อ"

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
