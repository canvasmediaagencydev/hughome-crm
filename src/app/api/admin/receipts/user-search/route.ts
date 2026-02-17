import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.RECEIPTS_UPLOAD)
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search')?.trim() ?? ''
    const tagId = searchParams.get('tag')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 50)

    let tagUserIds: string[] | null = null
    if (tagId) {
      const { data: tagUsers } = await supabase
        .from('user_tags')
        .select('user_id')
        .eq('tag_id', tagId)
      tagUserIds = tagUsers?.map((item) => item.user_id) || []
      if (tagUserIds.length === 0) {
        return NextResponse.json({ users: [] })
      }
    }

    let query = supabase
      .from('user_profiles')
      .select('id, first_name, last_name, phone, customer_code, points_balance, role, created_at')
      .not('role', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (tagUserIds) {
      query = query.in('id', tagUserIds)
    }

    if (search) {
      const searchPattern = `%${search}%`
      query = query.or(
        `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},phone.ilike.${searchPattern},customer_code.ilike.${searchPattern}`
      )
    }

    const { data: users, error } = await query

    if (error) {
      console.error('User search error:', error)
      return NextResponse.json({ error: 'ไม่สามารถค้นหาผู้ใช้ได้' }, { status: 500 })
    }

    const userIds = users?.map((u) => u.id) || []
    let userTagsMap: Record<string, { id: string; name: string; color: string | null }[]> = {}

    if (userIds.length > 0) {
      const { data: userTags } = await supabase
        .from('user_tags')
        .select('user_id, tags(id, name, color)')
        .in('user_id', userIds)

      userTags?.forEach((item: any) => {
        if (!userTagsMap[item.user_id]) {
          userTagsMap[item.user_id] = []
        }
        if (item.tags) {
          userTagsMap[item.user_id].push(item.tags)
        }
      })
    }

    const result = (users || []).map((user) => ({
      ...user,
      tags: userTagsMap[user.id] || [],
    }))

    return NextResponse.json({ users: result })
  } catch (error) {
    console.error('Admin user search error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการค้นหาผู้ใช้' },
      { status: 500 }
    )
  }
}
