import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface AdjustPointsRequest {
  amount: number;
  reason: string;
  type: "bonus" | "refund" | "spent";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: AdjustPointsRequest = await request.json();
    const { amount, reason, type } = body;

    if (!amount || typeof amount !== "number" || amount === 0) {
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

    // Get current user
    const { data: user, error: userError } = await supabase
      .from("user_profiles")
      .select("points_balance")
      .eq("id", id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate new balance
    const currentBalance = user.points_balance ?? 0;
    const newBalance = currentBalance + amount;

    if (newBalance < 0) {
      return NextResponse.json(
        { error: "Insufficient points balance" },
        { status: 400 }
      );
    }

    // Update user points balance
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ points_balance: newBalance })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update points balance" },
        { status: 500 }
      );
    }

    // Create point transaction record
    const { error: transactionError } = await supabase
      .from("point_transactions")
      .insert({
        user_id: id,
        points: amount,
        type: type,
        description: reason,
        balance_after: newBalance,
      });

    if (transactionError) {
      // Rollback points update if transaction creation fails
      await supabase
        .from("user_profiles")
        .update({ points_balance: currentBalance })
        .eq("id", id);

      return NextResponse.json(
        { error: "Failed to create transaction record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      new_balance: newBalance,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to adjust points" },
      { status: 500 }
    );
  }
}
