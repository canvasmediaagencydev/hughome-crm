# Supabase — Migration Runbook (Phase 1: ฐานเปล่า)

อ้างอิง **MIGRATION_PLAN.md §5**. Sprint 1 สร้าง migration 001–012 แล้ว
(013 `seed_demo_data.sql` เป็นงาน Sprint 9 · seed แบบรันมือ)

## โครงโฟลเดอร์

```
supabase/
├── migrations/                 ← UP migrations (supabase db push รันไฟล์พวกนี้)
│   ├── 001_init_enums.sql … 012_seed_permissions_roles.sql
│   └── rollback/               ← DOWN migrations (ไม่ถูก push อัตโนมัติ)
│       └── 00N_*.down.sql
└── seed/                       ← seed แบบรันมือ (tenant_code, demo data) — ไม่อยู่ใน push path
```

> `supabase db push` อ่านเฉพาะ `migrations/*.sql` (ไม่ recurse) → ไฟล์ใน
> `migrations/rollback/` และ `seed/` **จะไม่ถูก apply อัตโนมัติ** ตั้งใจแบบนี้เพื่อ
> ไม่ให้ push เผลอรันไฟล์ down/seed

---

## กติกาเหล็ก

1. **ห้ามแก้ schema ผ่าน Supabase Dashboard เด็ดขาด** — ทุกการเปลี่ยน schema ต้องเป็นไฟล์
   `.sql` ใน `migrations/` เท่านั้น (dashboard = สาเหตุอันดับหนึ่งของ drift ตอน Phase 2)
2. **`seed_demo_data.sql` รันด้วยมือเท่านั้น** — เก็บใน `supabase/seed/` ห้ามอยู่ใน migration path (§9.6)
3. Phase 1 = ฐานเปล่า → รีเซ็ตสร้างใหม่จาก 0 ได้ตลอด

---

## Prerequisites
- Supabase CLI (`supabase --version`) + `supabase login`
- `<PROJECT_REF>` = ref ของ Supabase **pilot** (Dashboard → Project Settings → General → Reference ID)
  — pilot ปัจจุบัน: `zoaxqouayhjkyterzzdt`

---

## คำสั่งหลัก

### 1. Link (ครั้งเดียวต่อเครื่อง)
```bash
supabase link --project-ref <PROJECT_REF>
```

### 2. Push migrations (001 → 012)
```bash
supabase db push
```
> ถ้า CLI เวอร์ชันใหม่ไม่รับเลขนำหน้าแบบ `001_` (บังคับ timestamp) ให้ apply ผ่าน psql แทน:
> ```bash
> for f in supabase/migrations/[0-9]*.sql; do echo ">> $f"; psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
> ```

### 3. Seed tenant_code (ต่อ instance — จำเป็นก่อน production)
`app_config.tenant_code` ต้องตรงกับ `NEXT_PUBLIC_TENANT_CODE` ใน env ไม่งั้น tenant-guard
จะไม่ให้บูต (prod) / เตือน (dev) — ดู `src/config/tenant-guard.ts`
```bash
# pilot:
psql "$SUPABASE_DB_URL" -c "INSERT INTO app_config(key,value) VALUES('tenant_code','pilot') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;"
```
> ⚠️ **ห้าม** hardcode tenant_code ใน migration (migration ใช้ร่วมทุก instance ใน Phase 2) — set ต่อ instance ตรงนี้เท่านั้น

### 4. Regenerate database.types.ts (หลัง schema เปลี่ยน)
```bash
supabase gen types typescript --project-id <PROJECT_REF> > database.types.ts
```
> หลัง regen: enum/ตารางเก่า (receipts, redemption_status เดิม) จะหาย → code receipts/redemptions
> เดิมจะ error ตอน tsc — เป็นเรื่องปกติ จะถูกกวาด/rework ใน Sprint 3 & 8

### 5. ตรวจ drift
```bash
supabase db diff        # ต้องว่าง = local ตรง remote (Phase 2 รันทุกครั้งหลัง deploy)
```

### รีเซ็ต local dev
```bash
supabase db reset       # drop + rerun ทุก migration จาก 0 (local เท่านั้น)
```

---

## Rollback (ด้วยมือ)
DOWN scripts อยู่ใน `migrations/rollback/` รันย้อนจากเลขมากไปน้อย เช่นถอย 012:
```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/rollback/012_seed_permissions_roles.down.sql
```

---

## ลำดับไฟล์ migration (Sprint 1 — สร้างแล้ว)

| # | ไฟล์ | เนื้อหา |
|---|------|---------|
| 001 | `init_enums.sql` | user_role, transaction_type, redemption_status (target), batch_status |
| 002 | `init_core_tables.sql` | **app_config**, user_profiles, point_settings (+seed baht_per_point), point_transactions, tags, user_tags, user_notes |
| 003 | `init_admin_rbac.sql` | 5 ตาราง RBAC + wire admin-actor FKs ของ 002 |
| 004 | `init_rewards_redemptions.sql` | rewards, redemptions (pickup_code/delivered_*) |
| 005 | `create_promo_codes.sql` | |
| 006 | `create_point_batches.sql` | + wire point_transactions.source_batch_id FK |
| 007 | `create_point_batch_ledger.sql` | step-wise expiry |
| 008 | `create_notification_channels.sql` | |
| 009 | `create_line_quota_cache.sql` | |
| 010 | `rpc_points_functions.sql` | award/void/redeem/expire/adjust (SECURITY DEFINER, service_role only) |
| 011 | `rls_policies.sql` | enable RLS ทุกตาราง (deny-by-default, server ใช้ service_role) |
| 012 | `seed_permissions_roles.sql` | 27 permissions + 6 roles (ไม่มี receipts.*) |
| 013 | `seed_demo_data.sql` | **Sprint 9 · แยก supabase/seed/ · รันมือ** |
