import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";
import { parseISO, subDays, startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    // ต้องมี users.view permission
    await requirePermission(PERMISSIONS.USERS_VIEW);

    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const tagId = searchParams.get("tag");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const days = searchParams.get("days");
    const pointsMin = searchParams.get("points_min");
    const pointsMax = searchParams.get("points_max");

    // If filtering by tag, get user IDs first
    let tagUserIds: string[] | null = null;
    if (tagId) {
      const { data: tagUsers } = await supabase
        .from("user_tags")
        .select("user_id")
        .eq("tag_id", tagId);
      tagUserIds = tagUsers?.map((t) => t.user_id) || [];
    }

    let query = supabase
      .from("user_profiles")
      .select("*", { count: "exact" })
      .not("role", "is", null) // Filter only users with role (not null)
      .order("points_balance", { ascending: false, nullsFirst: false });

    // Filter by tag
    if (tagUserIds !== null) {
      if (tagUserIds.length === 0) {
        return NextResponse.json({
          users: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }
      query = query.in("id", tagUserIds);
    }

    // Date filtering (only if explicitly provided)
    if (startDate && endDate) {
      const start = startOfDay(parseISO(startDate)).toISOString();
      const end = endOfDay(parseISO(endDate)).toISOString();
      query = query.gte('created_at', start).lte('created_at', end);
    } else if (days) {
      const cutoffDate = subDays(new Date(), parseInt(days));
      query = query.gte('created_at', cutoffDate.toISOString());
    }

    // Filter by points range
    if (pointsMin) {
      query = query.gte('points_balance', parseInt(pointsMin));
    }
    if (pointsMax) {
      query = query.lte('points_balance', parseInt(pointsMax));
    }

    // Store original search term for full name matching later
    const originalSearch = search?.trim();
    const hasFullNameSearch = originalSearch && originalSearch.includes(' ');

    // Filter by role first
    if (role && role !== "all") {
      query = query.eq("role", role);
    }

    // Handle search differently based on whether it's a full name search or not
    if (originalSearch && !hasFullNameSearch) {
      // Simple search (no space) - use database query
      const searchPattern = `%${originalSearch}%`;
      query = query.or(
        `first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},phone.ilike.${searchPattern},customer_code.ilike.${searchPattern}`
      );

      // Normal pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    } else if (hasFullNameSearch) {
      // Full name search - fetch all matching results (up to reasonable limit)
      // We'll filter client-side, so fetch more results
      query = query.range(0, 999); // Fetch up to 1000 results
    } else {
      // No search - normal pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data: users, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Additional client-side filtering for full name search
    let filteredUsers = users || [];
    let finalCount = count || 0;

    if (hasFullNameSearch && originalSearch) {
      const searchLower = originalSearch.toLowerCase();

      // Filter users where "first_name last_name" matches the search term
      filteredUsers = (users || []).filter(user => {
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase();
        const reverseName = `${user.last_name || ''} ${user.first_name || ''}`.trim().toLowerCase();
        const phone = (user.phone || '').toLowerCase();

        return fullName.includes(searchLower) ||
               reverseName.includes(searchLower) ||
               phone.includes(searchLower);
      });

      // Update count and apply pagination to filtered results
      finalCount = filteredUsers.length;
      const from = (page - 1) * limit;
      const to = from + limit;
      filteredUsers = filteredUsers.slice(from, to);
    }

    // Fetch latest note and tags for each user
    const userIds = filteredUsers?.map(u => u.id) || [];
    let latestNotes: any[] = [];
    let userTagsMap: Record<string, any[]> = {};

    if (userIds.length > 0) {
      // Get latest note for each user
      const [{ data: notes }, { data: userTagsData }] = await Promise.all([
        supabase
          .from('user_notes')
          .select('id, user_id, note_content, created_at')
          .in('user_id', userIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_tags')
          .select('user_id, tags(id, name, color)')
          .in('user_id', userIds),
      ]);

      // Group notes by user_id and take first (latest) note
      const notesMap = new Map();
      notes?.forEach(note => {
        if (!notesMap.has(note.user_id)) {
          notesMap.set(note.user_id, note);
        }
      });
      latestNotes = Array.from(notesMap.values());

      // Group tags by user_id
      userTagsData?.forEach((ut: any) => {
        if (!userTagsMap[ut.user_id]) {
          userTagsMap[ut.user_id] = [];
        }
        if (ut.tags) {
          userTagsMap[ut.user_id].push(ut.tags);
        }
      });
    }

    // Add latest_note and tags to each user
    const usersWithNotes = filteredUsers?.map(user => ({
      ...user,
      latest_note: latestNotes.find(n => n.user_id === user.id) || null,
      tags: userTagsMap[user.id] || [],
    }));

    return NextResponse.json({
      users: usersWithNotes,
      pagination: {
        page,
        limit,
        total: finalCount,
        totalPages: Math.ceil(finalCount / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
