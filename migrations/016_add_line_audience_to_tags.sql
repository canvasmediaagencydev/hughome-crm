ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS line_audience_id BIGINT;

COMMENT ON COLUMN public.tags.line_audience_id IS
  'LINE Audience Group ID สำหรับ broadcast ผ่าน LINE OA Manager';
