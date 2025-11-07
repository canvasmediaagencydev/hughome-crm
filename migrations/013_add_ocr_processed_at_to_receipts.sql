-- Add ocr_processed_at timestamp to receipts table
-- This tracks when the OCR was last processed (both initial upload and re-check)

ALTER TABLE receipts
ADD COLUMN ocr_processed_at TIMESTAMPTZ;

-- Set existing records to use created_at as initial OCR timestamp
UPDATE receipts
SET ocr_processed_at = created_at
WHERE ocr_processed_at IS NULL AND ocr_data IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN receipts.ocr_processed_at IS 'Timestamp of when OCR was last processed (initial or re-check)';
