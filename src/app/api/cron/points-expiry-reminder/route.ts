import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { notifyExpiryWarning } from "@/lib/line-messaging";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Send warnings at these day offsets before expiry
const WARNING_DAYS = [7, 3, 1] as const;

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();

  // For each warning offset, find users whose points_expire_at falls on the
  // target date (in Asia/Bangkok). Build a UTC range covering that local day.
  let totalSent = 0;
  const breakdown: Record<string, number> = {};

  for (const offset of WARNING_DAYS) {
    const { fromIso, toIso } = bangkokDayRangeOffset(offset);

    const { data: users, error } = await supabase
      .from("user_profiles")
      .select("id, line_user_id, points_balance, points_expire_at")
      .gt("points_balance", 0)
      .not("line_user_id", "is", null)
      .gte("points_expire_at", fromIso)
      .lt("points_expire_at", toIso);

    if (error) {
      console.error(`[CRON expiry-reminder] offset=${offset} query failed:`, error);
      continue;
    }

    for (const u of users ?? []) {
      if (!u.line_user_id || !u.points_expire_at) continue;
      await notifyExpiryWarning(u.line_user_id, {
        pointsBalance: u.points_balance ?? 0,
        expireAt: new Date(u.points_expire_at),
        daysLeft: offset,
      });
      totalSent++;
    }

    breakdown[`day_${offset}`] = (users ?? []).length;
  }

  return NextResponse.json({
    success: true,
    sent: totalSent,
    breakdown,
  });
}

// Returns the UTC ISO range covering the Asia/Bangkok day that is `offset`
// days from today.
function bangkokDayRangeOffset(offset: number): { fromIso: string; toIso: string } {
  const now = new Date();
  const bkkToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "YYYY-MM-DD"

  // Build the target local date as YYYY-MM-DD, then convert local midnight → UTC.
  const [y, m, d] = bkkToday.split("-").map(Number);
  // local midnight in Bangkok = UTC midnight minus 7h
  const targetMidnightUtc = Date.UTC(y, m - 1, d + offset, -7, 0, 0);
  const from = new Date(targetMidnightUtc);
  const to = new Date(targetMidnightUtc + 24 * 60 * 60 * 1000);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}
