import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { notifyBirthday } from "@/lib/line-messaging";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();

  // Compute today's MM-DD in Asia/Bangkok timezone
  const now = new Date();
  const bkkDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "YYYY-MM-DD"
  const [, monthStr, dayStr] = bkkDate.split("-");

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

  const todayMmDd = `${monthStr}-${dayStr}`;
  const targets = (users ?? []).filter((u) => {
    if (!u.birthday) return false;
    // birthday is "YYYY-MM-DD"; compare last 5 chars
    return u.birthday.slice(5) === todayMmDd;
  });

  let sent = 0;
  for (const u of targets) {
    const name = u.display_name || u.first_name || null;
    await notifyBirthday(u.line_user_id, name);
    sent++;
  }

  return NextResponse.json({
    success: true,
    date: bkkDate,
    matched: targets.length,
    sent,
  });
}
