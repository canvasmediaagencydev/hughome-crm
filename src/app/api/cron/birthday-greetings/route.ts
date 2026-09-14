/**
 * GET /api/cron/birthday-greetings — อวยพรวันเกิดทาง LINE (รายวัน)
 *
 * อ่านอย่างเดียว + push · dedupe ต่อ (user, ปี) ผ่าน notification_log — cron รันซ้ำวันเดียวกันไม่ส่งซ้ำ
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { notifyBirthday } from "@/lib/line-messaging";
import { todayBangkok } from "@/lib/bangkok-date";
import { loadSentKeys, logSent, sentKey } from "@/lib/notification-log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const bkkDate = todayBangkok(); // "YYYY-MM-DD"
  const [year] = bkkDate.split("-");
  const todayMmDd = bkkDate.slice(5);

  // Find users whose birthday matches today's MM-DD
  const { data: users, error } = await supabase
    .from("user_profiles")
    .select("id, line_user_id, display_name, first_name, birthday")
    .not("birthday", "is", null)
    .not("line_user_id", "is", null);

  if (error) {
    console.error("[CRON birthday] query failed:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const targets = (users ?? []).filter((u) => u.birthday && u.birthday.slice(5) === todayMmDd);
  const sent = await loadSentKeys(supabase, "birthday", targets.map((u) => u.id));

  let sentCount = 0;
  let skippedDedupe = 0;
  let pushFailed = 0;
  for (const u of targets) {
    if (sent.has(sentKey(u.id, year))) {
      skippedDedupe++;
      continue;
    }
    const name = u.display_name || u.first_name || null;
    const ok = await notifyBirthday(u.line_user_id, name);
    if (ok) {
      sentCount++;
      await logSent(supabase, "birthday", [{ user_id: u.id, window_key: year }]);
    } else {
      pushFailed++;
    }
  }

  return NextResponse.json({
    success: true,
    date: bkkDate,
    matched: targets.length,
    sent: sentCount,
    skipped_dedupe: skippedDedupe,
    push_failed: pushFailed,
  });
}
