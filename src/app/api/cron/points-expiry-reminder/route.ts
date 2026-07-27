import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

// DISABLED: the old reminder used user_profiles.points_expire_at (removed). The
// new model warns 1–3 months before per-lot expiry (point_batch_ledger) via
// /api/cron/points-expiry-warning in Sprint 7. Safe no-op until then.
export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    disabled: true,
    message: "Replaced by step-wise ledger expiry warnings (Sprint 7). No-op.",
  });
}
