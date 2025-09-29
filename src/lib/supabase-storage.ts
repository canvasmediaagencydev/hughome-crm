import { createClientSupabaseClient } from '@/lib/supabase-server'

export function getReceiptImageUrl(filePath: string): string {
  if (!filePath) return ''

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    console.error('NEXT_PUBLIC_SUPABASE_URL is not defined')
    return ''
  }

  // Use the original path as-is since the files are stored with 'receipts/' prefix
  return `${supabaseUrl}/storage/v1/object/public/receipts/${filePath}`
}

export async function getSignedReceiptImageUrl(filePath: string): Promise<string> {
  try {
    if (!filePath) return ''

    const supabase = createClientSupabaseClient()

    // Use the original path as-is for signed URLs
    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (error) {
      console.error('Error creating signed URL:', error)
      return getReceiptImageUrl(filePath) // Fallback to public URL
    }

    return data?.signedUrl || ''
  } catch (error) {
    console.error('Error getting signed URL:', error)
    return getReceiptImageUrl(filePath) // Fallback to public URL
  }
}