import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";
import {
  addUsersToAudience,
  deleteLineAudience,
  resyncAudience,
} from "@/lib/line-messaging";

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

    // Sync to LINE Audience Group (best-effort)
    try {
      const [userResult, tagResult] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("line_user_id")
          .eq("id", id)
          .single(),
        supabase
          .from("tags")
          .select("line_audience_id")
          .eq("id", tag_id)
          .single(),
      ]);

      const lineUserId = userResult.data?.line_user_id;
      const audienceGroupId = tagResult.data?.line_audience_id;

      if (lineUserId && audienceGroupId) {
        await addUsersToAudience(audienceGroupId, [lineUserId]);
      }
    } catch (lineError) {
      console.error("[LINE] Failed to add user to audience:", lineError);
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

    // Resync LINE Audience Group (best-effort)
    try {
      const tagResult = await supabase
        .from("tags")
        .select("name, line_audience_id")
        .eq("id", tag_id)
        .single();

      const tag = tagResult.data;
      if (tag?.line_audience_id) {
        // Get remaining users with this tag that have a LINE user ID
        const remainingResult = await supabase
          .from("user_tags")
          .select("user_profiles!inner(line_user_id)")
          .eq("tag_id", tag_id);

        const remainingLineUserIds = (remainingResult.data || [])
          .map((row: Record<string, unknown>) => {
            const profile = row.user_profiles as { line_user_id: string | null } | null;
            return profile?.line_user_id;
          })
          .filter((id): id is string => Boolean(id));

        // Delete existing audience first
        await deleteLineAudience(tag.line_audience_id);

        if (remainingLineUserIds.length > 0) {
          const newAudienceId = await resyncAudience(tag.name, remainingLineUserIds);
          await supabase
            .from("tags")
            .update({ line_audience_id: newAudienceId })
            .eq("id", tag_id);
        } else {
          await supabase
            .from("tags")
            .update({ line_audience_id: null })
            .eq("id", tag_id);
        }
      }
    } catch (lineError) {
      console.error("[LINE] Failed to resync audience after tag removal:", lineError);
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
