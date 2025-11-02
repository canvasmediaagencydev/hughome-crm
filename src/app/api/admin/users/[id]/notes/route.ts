import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission, requireAdmin, hasAnyPermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin();
    const canViewNotes = await hasAnyPermission(adminUser.id, [
      PERMISSIONS.USERS_MANAGE_NOTES,
      PERMISSIONS.USERS_VIEW,
    ]);

    if (!canViewNotes) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createServerSupabaseClient();

    // Get pagination params
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    // Calculate offset
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Fetch notes with admin info
    const { data: notes, count, error } = await supabase
      .from("user_notes")
      .select(`
        id,
        note_content,
        created_at,
        updated_at,
        created_by,
        created_by_admin_id,
        user_profiles!user_notes_created_by_fkey (
          id,
          display_name,
          picture_url
        ),
        created_by_admin:admin_users!user_notes_created_by_admin_id_fkey (
          id,
          full_name,
          email
        )
      `, { count: "exact" })
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      notes: notes || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch user notes" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ต้องมี users.manage_notes permission
    const adminUser = await requirePermission(PERMISSIONS.USERS_MANAGE_NOTES);

    const { id } = await params;
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { note_content } = body;

    if (!note_content || note_content.trim().length === 0) {
      return NextResponse.json(
        { error: "Note content is required" },
        { status: 400 }
      );
    }

    // Insert new note with the authenticated admin user ID
    const { data: note, error } = await supabase
      .from("user_notes")
      .insert({
        user_id: id,
        note_content: note_content.trim(),
        created_by: id,
        created_by_admin_id: adminUser.id,
      })
      .select(`
        id,
        note_content,
        created_at,
        updated_at,
        created_by,
        created_by_admin_id,
        user_profiles!user_notes_created_by_fkey (
          id,
          display_name,
          picture_url
        ),
        created_by_admin:admin_users!user_notes_created_by_admin_id_fkey (
          id,
          full_name,
          email
        )
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}
