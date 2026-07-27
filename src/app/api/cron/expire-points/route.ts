import { NextRequest, NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

// DISABLED: the old anniversary-based expiry used user_profiles.points_expire_at,
// which no longer exists. The new model expires points step-wise per ledger lot
// (point_batch_ledger) via the RPC expire_ledger_batches — implemented as
// /api/cron/expire-points-monthly in Sprint 7. This endpoint is a safe no-op
// until then (kept so the existing Vercel cron entry doesn't 500).
export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    disabled: true,
    message: "Replaced by step-wise ledger expiry (Sprint 7). No-op.",
  });
}
