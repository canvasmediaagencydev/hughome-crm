import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";
import { notifyPointChange, type PointNotificationKind } from "@/lib/line-messaging";

interface AdjustPointsRequest {
  amount: number;
  reason: string;
  type: "bonus" | "refund" | "spent";
}

/**
 * POST /api/admin/users/:id/points — ปรับแต้มมือ
 *
 * เงินขยับใน RPC adjust_points_manual (migration 010) ภายใต้ row lock:
 * +amount สร้าง lot ใหม่ใน point_batch_ledger (มีวันหมดอายุ หัก FIFO ได้)
 * −amount หัก FIFO จาก lot ที่ยังไม่หมดอายุ · ลง point_transactions พร้อม created_by
 * ห้าม UPDATE points_balance / INSERT ledger จากที่นี่
 *
 * `type` ใช้เลือกข้อความ LINE เท่านั้น — ชนิดธุรกรรมในฐาน RPC กำหนดจากเครื่องหมาย
 * (+ = bonus, − = spent)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ต้องมี users.manage_points permission
    const adminUser = await requirePermission(PERMISSIONS.USERS_MANAGE_POINTS);

    const { id } = await params;
    const body: AdjustPointsRequest = await request.json();
    const { amount, reason, type } = body;

    if (!amount || typeof amount !== "number" || !Number.isInteger(amount) || amount === 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return NextResponse.json(
        { error: "Reason is required" },
        { status: 400 }
      );
    }

    if (!["bonus", "refund", "spent"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Need line_user_id for the push; also confirms the user exists before touching money.
    const { data: user, error: userError } = await supabase
      .from("user_profiles")
      .select("line_user_id")
      .eq("id", id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: newBalance, error: rpcError } = await supabase.rpc("adjust_points_manual", {
      p_user: id,
      p_delta: amount,
      p_admin: adminUser.id,
      p_note: reason.trim(),
    });

    if (rpcError || typeof newBalance !== "number") {
      // RPC RAISEs when the deduction would drive the balance negative or
      // active lots cannot cover it (ledger/balance mismatch).
      console.warn("adjust_points_manual failed:", rpcError?.message);
      const insufficient = /negative|mismatch/.test(rpcError?.message ?? "");
      return NextResponse.json(
        { error: insufficient ? "Insufficient points balance" : "Failed to adjust points" },
        { status: insufficient ? 400 : 500 }
      );
    }

    // Notify user via LINE push message (fire-and-forget)
    const kindMap: Record<typeof type, PointNotificationKind> = {
      bonus: "points_bonus",
      refund: "points_refund",
      spent: "points_spent",
    };
    await notifyPointChange(user.line_user_id, {
      kind: kindMap[type],
      pointsDelta: amount,
      newBalance,
    });

    return NextResponse.json({
      success: true,
      new_balance: newBalance,
    });
  } catch (error) {
    console.error("Adjust points error:", error);
    return NextResponse.json(
      { error: "Failed to adjust points" },
      { status: 500 }
    );
  }
}
