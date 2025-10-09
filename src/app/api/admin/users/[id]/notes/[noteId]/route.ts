import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { noteId } = await params;
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { note_content } = body;

    if (!note_content || note_content.trim().length === 0) {
      return NextResponse.json(
        { error: "Note content is required" },
        { status: 400 }
      );
    }

    // Update note
    const { data: note, error } = await supabase
      .from("user_notes")
      .update({
        note_content: note_content.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId)
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
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Note not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { noteId } = await params;
    const supabase = createServerSupabaseClient();

    // Delete note
    const { error } = await supabase
      .from("user_notes")
      .delete()
      .eq("id", noteId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
