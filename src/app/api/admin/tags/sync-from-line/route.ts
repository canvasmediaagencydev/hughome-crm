import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";
import {
  listLineAudiences,
  createLineAudience,
  addUsersToAudience,
} from "@/lib/line-messaging";

// POST /api/admin/tags/sync-from-line
// 1. ดึง Audience Groups จาก LINE OA → link กับ tags ที่ชื่อตรงกัน
// 2. Tags ที่ยังไม่มี line_audience_id → สร้าง Audience Group ให้อัตโนมัติ พร้อม users
export async function POST() {
  try {
    const adminUser = await requirePermission(PERMISSIONS.TAGS_MANAGE);
    const supabase = createServerSupabaseClient();

    const results: { name: string; line_audience_id: number; action: string }[] = [];

    // --- Phase 1: ดึง Audience Groups จาก LINE แล้ว link กับ tags ที่ชื่อตรงกัน ---
    const audiences = await listLineAudiences();

    for (const audience of audiences) {
      const name = audience.description?.trim();
      if (!name) continue;

      const { data: existing } = await supabase
        .from("tags")
        .select("id, name, line_audience_id")
        .eq("name", name)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("tags")
          .update({ line_audience_id: audience.audienceGroupId })
          .eq("id", existing.id);
        results.push({ name, line_audience_id: audience.audienceGroupId, action: "linked" });
      } else {
        await supabase.from("tags").insert({
          name,
          color: "#6366f1",
          created_by: adminUser.id,
          line_audience_id: audience.audienceGroupId,
        });
        results.push({ name, line_audience_id: audience.audienceGroupId, action: "imported" });
      }
    }

    // --- Phase 2: Tags ที่ยังไม่มี line_audience_id → สร้าง Audience Group ให้ ---
    const { data: orphanTags } = await supabase
      .from("tags")
      .select("id, name")
      .is("line_audience_id", null);

    for (const tag of orphanTags ?? []) {
      try {
        // ดึง line_user_id ของ users ทั้งหมดที่มี tag นี้
        const { data: userTags } = await supabase
          .from("user_tags")
          .select("user_profiles!inner(line_user_id)")
          .eq("tag_id", tag.id);

        const lineUserIds = (userTags ?? [])
          .map((row: Record<string, unknown>) => {
            const profile = row.user_profiles as { line_user_id: string | null } | null;
            return profile?.line_user_id;
          })
          .filter((id): id is string => Boolean(id));

        const audienceGroupId = await createLineAudience(tag.name);
        if (lineUserIds.length > 0) {
          await addUsersToAudience(audienceGroupId, lineUserIds);
        }

        await supabase
          .from("tags")
          .update({ line_audience_id: audienceGroupId })
          .eq("id", tag.id);

        results.push({ name: tag.name, line_audience_id: audienceGroupId, action: "backfilled" });
      } catch (err) {
        console.error(`[LINE] Failed to backfill audience for tag "${tag.name}":`, err);
      }
    }

    return NextResponse.json({ synced: results.length, tags: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: message || "Failed to sync from LINE" },
      { status: 500 }
    );
  }
}
