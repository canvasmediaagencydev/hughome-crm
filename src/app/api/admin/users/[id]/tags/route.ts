import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.USERS_VIEW);

    const { id } = await params;
    const supabase = createServerSupabaseClient();

    const { data: userTags, error } = await supabase
      .from("user_tags")
      .select("tag_id, assigned_at, tags(id, name, color, created_at)")
      .eq("user_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tags = (userTags || []).map((ut: Record<string, unknown>) => ut.tags);

    return NextResponse.json({ tags });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch user tags" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requirePermission(PERMISSIONS.USERS_MANAGE_TAGS);

    const { id } = await params;
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { tag_id } = body;

    if (!tag_id) {
      return NextResponse.json(
        { error: "tag_id is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("user_tags").insert({
      user_id: id,
      tag_id,
      assigned_by: adminUser.id,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "User already has this tag" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to add tag to user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE_TAGS);

    const { id } = await params;
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { tag_id } = body;

    if (!tag_id) {
      return NextResponse.json(
        { error: "tag_id is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("user_tags")
      .delete()
      .eq("user_id", id)
      .eq("tag_id", tag_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to remove tag from user" },
      { status: 500 }
    );
  }
}
