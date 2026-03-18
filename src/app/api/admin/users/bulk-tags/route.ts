import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";
import { addUsersToAudience, resyncAudience } from "@/lib/line-messaging";

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.USERS_MANAGE_TAGS);

    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { user_ids, tag_id, action } = body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: "user_ids is required" }, { status: 400 });
    }
    if (!tag_id) {
      return NextResponse.json({ error: "tag_id is required" }, { status: 400 });
    }
    if (action !== "add" && action !== "remove") {
      return NextResponse.json({ error: "action must be 'add' or 'remove'" }, { status: 400 });
    }

    if (action === "add") {
      const rows = user_ids.map((uid: string) => ({ user_id: uid, tag_id }));
      const { error } = await supabase
        .from("user_tags")
        .upsert(rows, { onConflict: "user_id,tag_id", ignoreDuplicates: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Sync to LINE audience (best-effort)
      try {
        const { data: tag } = await supabase
          .from("tags")
          .select("line_audience_id, name")
          .eq("id", tag_id)
          .single();

        if (tag?.line_audience_id) {
          const { data: userProfiles } = await supabase
            .from("user_profiles")
            .select("line_user_id")
            .in("id", user_ids)
            .not("line_user_id", "is", null);

          const lineUserIds = (userProfiles?.map((u) => u.line_user_id).filter(Boolean) ?? []) as string[];
          if (lineUserIds.length > 0) {
            await addUsersToAudience(tag.line_audience_id, lineUserIds);
          }
        }
      } catch {
        // best-effort
      }
    } else {
      const { error } = await supabase
        .from("user_tags")
        .delete()
        .eq("tag_id", tag_id)
        .in("user_id", user_ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Resync LINE audience (best-effort)
      try {
        const { data: tag } = await supabase
          .from("tags")
          .select("name")
          .eq("id", tag_id)
          .single();

        if (tag) {
          const { data: remainingTagUsers } = await supabase
            .from("user_tags")
            .select("user_id")
            .eq("tag_id", tag_id);

          const remainingUserIds = remainingTagUsers?.map((u) => u.user_id) ?? [];
          let lineUserIds: string[] = [];

          if (remainingUserIds.length > 0) {
            const { data: profiles } = await supabase
              .from("user_profiles")
              .select("line_user_id")
              .in("id", remainingUserIds)
              .not("line_user_id", "is", null);
            lineUserIds = (profiles?.map((u) => u.line_user_id).filter(Boolean) ?? []) as string[];
          }

          await resyncAudience(tag.name, lineUserIds);
        }
      } catch {
        // best-effort
      }
    }

    return NextResponse.json({ success: true, count: user_ids.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to bulk assign tags" }, { status: 500 });
  }
}
