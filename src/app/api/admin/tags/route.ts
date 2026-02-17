import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.TAGS_VIEW);

    const supabase = createServerSupabaseClient();

    const { data: tags, error } = await supabase
      .from("tags")
      .select("*")
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get user count for each tag
    const tagIds = tags?.map((t) => t.id) || [];
    let userCounts: Record<string, number> = {};

    if (tagIds.length > 0) {
      const { data: counts } = await supabase
        .from("user_tags")
        .select("tag_id");

      if (counts) {
        for (const row of counts) {
          userCounts[row.tag_id] = (userCounts[row.tag_id] || 0) + 1;
        }
      }
    }

    const tagsWithCount = (tags || []).map((tag) => ({
      ...tag,
      user_count: userCounts[tag.id] || 0,
    }));

    return NextResponse.json({ tags: tagsWithCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requirePermission(PERMISSIONS.TAGS_MANAGE);

    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { name, color } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    const { data: tag, error } = await supabase
      .from("tags")
      .insert({
        name: name.trim(),
        color: color || "#6366f1",
        created_by: adminUser.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Tag name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to create tag" },
      { status: 500 }
    );
  }
}
