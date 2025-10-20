import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
        user_profiles!user_notes_created_by_fkey (
          id,
          display_name,
          picture_url
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

    // Get the current authenticated admin user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Insert new note with the authenticated admin user ID
    const { data: note, error } = await supabase
      .from("user_notes")
      .insert({
        user_id: id,
        note_content: note_content.trim(),
        created_by: user.id,
      })
      .select(`
        id,
        note_content,
        created_at,
        updated_at,
        created_by,
        user_profiles!user_notes_created_by_fkey (
          id,
          display_name,
          picture_url
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
