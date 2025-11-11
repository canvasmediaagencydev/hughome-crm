// Script to apply migration 013 - add ocr_processed_at to receipts table
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigration() {
  console.log('Checking if ocr_processed_at column exists...')

  try {
    // Try to select the column - if it fails, it doesn't exist
    const { data, error } = await supabase
      .from('receipts')
      .select('ocr_processed_at')
      .limit(1)

    if (error && error.message.includes('column')) {
      console.log('Column does not exist. Please apply migration manually.')
      console.log('\nRun this SQL in Supabase dashboard (SQL Editor):')
      console.log('https://supabase.com/dashboard/project/roulkkzdbxhbtvpoecds/sql/new')
      console.log('\n---')
      console.log(`
ALTER TABLE receipts
ADD COLUMN ocr_processed_at TIMESTAMPTZ;

UPDATE receipts
SET ocr_processed_at = created_at
WHERE ocr_processed_at IS NULL AND ocr_data IS NOT NULL;

COMMENT ON COLUMN receipts.ocr_processed_at IS 'Timestamp of when OCR was last processed (initial or re-check)';
      `)
      console.log('---\n')
      console.log('After running the migration, regenerate types with:')
      console.log('npx supabase gen types typescript --project-id roulkkzdbxhbtvpoecds > database.types.ts')
      process.exit(1)
    } else {
      console.log('Column already exists!')
      console.log('Please regenerate types with:')
      console.log('npx supabase gen types typescript --project-id roulkkzdbxhbtvpoecds > database.types.ts')
    }
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

applyMigration()
