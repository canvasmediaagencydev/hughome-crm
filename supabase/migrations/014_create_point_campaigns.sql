-- 014_create_point_campaigns.sql — MIGRATION_PLAN.md §4.2, §9.7
-- แทน promo_codes: ตัวคูณแต้มพิเศษผูก "ช่วงวันที่" ตั้งจากหลังบ้านเท่านั้น
-- ไม่มีโค้ดให้พนักงานขายกรอกในไฟล์ Excel อีกแล้ว (กันการใส่ตัวคูณเกินสิทธิ์ให้ลูกค้าตัวเอง)
--
-- ห้ามซ้อนช่วง — บังคับด้วย EXCLUDE constraint ไม่ใช่แค่ validate ในแอป
-- ผลคือแต่ละวันมี multiplier ได้ค่าเดียว → parser/RPC เลือก campaign ได้แบบ
-- deterministic ไม่ต้องมีกฎ tie-break (ซึ่งเป็นจุดที่คนเถียงกันเรื่องแต้มภายหลัง)

CREATE TABLE point_campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  multiplier  numeric(4,2) NOT NULL CHECK (multiplier > 0),
  starts_on   date NOT NULL,                       -- inclusive
  ends_on     date NOT NULL,                       -- inclusive
  is_active   boolean NOT NULL DEFAULT true,        -- soft-delete (ledger อ้าง campaign อยู่)
  created_by  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT point_campaigns_range CHECK (ends_on >= starts_on),
  CONSTRAINT point_campaigns_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 120)
);

-- ช่วงวันที่ของ campaign ที่ active ห้ามทับกัน (range gist opclass มีใน core ไม่ต้องลง extension)
ALTER TABLE point_campaigns
  ADD CONSTRAINT point_campaigns_no_overlap
  EXCLUDE USING gist ((daterange(starts_on, ends_on, '[]')) WITH &&)
  WHERE (is_active);

-- lookup ตอน parse: หา campaign ที่คลุม purchase_date ของแต่ละแถว
CREATE INDEX point_campaigns_lookup_idx
  ON point_campaigns (starts_on, ends_on) WHERE is_active;
