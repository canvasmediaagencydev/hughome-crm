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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const days = searchParams.get("days");

    let query = supabase
      .from("user_profiles")
      .select("*", { count: "exact" })
      .not("role", "is", null) // Filter only users with role (not null)
      .order("points_balance", { ascending: false, nullsFirst: false });

    // Date filtering (only if explicitly provided)
    if (startDate && endDate) {
      const start = startOfDay(parseISO(startDate)).toISOString();
      const end = endOfDay(parseISO(endDate)).toISOString();
      query = query.gte('created_at', start).lte('created_at', end);
    } else if (days) {
      const cutoffDate = subDays(new Date(), parseInt(days));
      query = query.gte('created_at', cutoffDate.toISOString());
    }

    // Search by name or phone
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = query.or(
        `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm}`
      );
    }

    // Filter by role
    if (role && role !== "all") {
      query = query.eq("role", role);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: users, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch latest note for each user
    const userIds = users?.map(u => u.id) || [];
    let latestNotes: any[] = [];

    if (userIds.length > 0) {
      // Get latest note for each user
      const { data: notes } = await supabase
        .from('user_notes')
        .select('id, user_id, note_content, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });

      // Group by user_id and take first (latest) note
      const notesMap = new Map();
      notes?.forEach(note => {
        if (!notesMap.has(note.user_id)) {
          notesMap.set(note.user_id, note);
        }
      });
      latestNotes = Array.from(notesMap.values());
    }

    // Add latest_note to each user
    const usersWithNotes = users?.map(user => ({
      ...user,
      latest_note: latestNotes.find(n => n.user_id === user.id) || null
    }));

    return NextResponse.json({
      users: usersWithNotes,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
