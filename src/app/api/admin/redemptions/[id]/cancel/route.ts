import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";
import { adminAuthError } from "@/lib/admin-http";

/**
 * POST /api/admin/redemptions/:id/cancel — ยกเลิกใบแลก คืนแต้ม+สต็อก
 *
 * เงินทั้งหมดขยับใน RPC cancel_redemption (migration 021) ภายใต้ row lock:
 * คืนแต้มเข้า lot เดิม (ledger) + points_balance + point_transactions + สต็อก + status
 * ในธุรกรรมเดียว — ห้าม UPDATE points_balance จากที่นี่
 *
 * ผู้ยกเลิก = admin จาก session เท่านั้น (ไม่รับ adminId จาก body)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ต้องมี redemptions.process permission
    const adminUser = await requirePermission(PERMISSIONS.REDEMPTIONS_PROCESS);

    const supabase = createServerSupabaseClient();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    // RPC stores NULL for an empty note.
    const adminNotes = typeof body?.adminNotes === "string" ? body.adminNotes.trim() : "";

    const { data: newBalance, error } = await supabase.rpc("cancel_redemption", {
      p_redemption: id,
      p_admin: adminUser.id,
      p_note: adminNotes,
    });

    if (error) {
      // RPC RAISEs on not found / already delivered or cancelled / inactive admin.
      console.warn("cancel_redemption failed:", error.message);
      const notFound = /not found/.test(error.message);
      return NextResponse.json(
        { error: error.message || "ไม่สามารถยกเลิกการแลกรางวัลได้" },
        { status: notFound ? 404 : 400 }
      );
    }

    const { data: updatedRedemption } = await supabase
      .from("redemptions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      redemption: updatedRedemption,
      newBalance,
    });
  } catch (error) {
    const auth = adminAuthError(error);
    if (auth) return auth;
    console.error("Cancel redemption error:", error);
    return NextResponse.json(
      { error: "ยกเลิกการแลกรางวัลไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
