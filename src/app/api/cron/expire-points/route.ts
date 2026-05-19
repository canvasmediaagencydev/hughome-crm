import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { notifyExpiryExecuted } from "@/lib/line-messaging";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  // Find users whose anniversary has arrived (points_expire_at <= now)
  const { data: users, error } = await supabase
    .from("user_profiles")
    .select("id, line_user_id, points_balance, points_expire_at, created_at")
    .lte("points_expire_at", nowIso);

  if (error) {
    console.error("[CRON expire-points] query failed:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let expiredCount = 0;
  let notifiedCount = 0;

  for (const u of users ?? []) {
    if (!u.points_expire_at) continue;
    const balance = u.points_balance ?? 0;

    // Roll points_expire_at forward by 365-day steps until it's in the future
    const nextExpire = nextAnniversary(new Date(u.points_expire_at));

    // Always advance points_expire_at; only zero balance + log when balance > 0
    if (balance > 0) {
      // Zero out balance
      const { error: updateErr } = await supabase
        .from("user_profiles")
        .update({
          points_balance: 0,
          points_expire_at: nextExpire.toISOString(),
        })
        .eq("id", u.id);

      if (updateErr) {
        console.error(`[CRON expire-points] failed to update user ${u.id}:`, updateErr);
        continue;
      }

      // Log transaction
      const { error: txErr } = await supabase.from("point_transactions").insert({
        user_id: u.id,
        type: "expired",
        points: -balance,
        balance_after: 0,
        description: "แต้มหมดอายุ (ครบรอบวันสมัคร)",
      });
      if (txErr) {
        console.error(`[CRON expire-points] failed to log tx for ${u.id}:`, txErr);
      }

      expiredCount++;

      // Notify user
      if (u.line_user_id) {
        await notifyExpiryExecuted(u.line_user_id, {
          expiredPoints: balance,
          nextExpireAt: nextExpire,
        });
        notifiedCount++;
      }
    } else {
      // No balance to expire; still bump the anniversary so we don't re-process
      const { error: updateErr } = await supabase
        .from("user_profiles")
        .update({ points_expire_at: nextExpire.toISOString() })
        .eq("id", u.id);
      if (updateErr) {
        console.error(`[CRON expire-points] failed to bump anniversary for ${u.id}:`, updateErr);
      }
    }
  }

  return NextResponse.json({
    success: true,
    processed: (users ?? []).length,
    expired: expiredCount,
    notified: notifiedCount,
  });
}

function nextAnniversary(currentExpire: Date): Date {
  const now = Date.now();
  const next = new Date(currentExpire);
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  while (next.getTime() <= now) {
    next.setTime(next.getTime() + oneYearMs);
  }
  return next;
}
