import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const { userId, rewardId, quantity = 1, shippingAddress } = body;

    if (!userId || !rewardId) {
      return NextResponse.json(
        { error: "User ID and Reward ID are required" },
        { status: 400 }
      );
    }

    // Fetch user profile to check points balance
    const { data: user, error: userError } = await supabase
      .from("user_profiles")
      .select("points_balance")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Fetch reward details
    const { data: reward, error: rewardError } = await supabase
      .from("rewards")
      .select("*")
      .eq("id", rewardId)
      .single();

    if (rewardError || !reward) {
      return NextResponse.json(
        { error: "Reward not found" },
        { status: 404 }
      );
    }

    // Check if reward is active
    if (!reward.is_active) {
      return NextResponse.json(
        { error: "Reward is not available" },
        { status: 400 }
      );
    }

    // Check stock availability
    if (reward.stock_quantity !== null) {
      // Fetch redemptions to calculate remaining stock
      const { data: redemptions, error: redemptionsError } = await supabase
        .from("redemptions")
        .select("quantity")
        .eq("reward_id", rewardId)
        .neq("status", "cancelled");

      if (redemptionsError) {
        return NextResponse.json(
          { error: "Failed to check stock" },
          { status: 500 }
        );
      }

      const redeemedCount = redemptions?.reduce((sum, r) => sum + (r.quantity || 1), 0) || 0;
      const remainingStock = reward.stock_quantity - redeemedCount;

      if (remainingStock < quantity) {
        return NextResponse.json(
          { error: "Insufficient stock" },
          { status: 400 }
        );
      }
    }

    // Calculate total points needed
    const totalPoints = reward.points_cost * quantity;

    // Check if user has enough points
    if (user.points_balance < totalPoints) {
      return NextResponse.json(
        { error: "Insufficient points" },
        { status: 400 }
      );
    }

    // Create redemption record
    const { data: redemption, error: redemptionError } = await supabase
      .from("redemptions")
      .insert({
        user_id: userId,
        reward_id: rewardId,
        points_used: totalPoints,
        quantity: quantity,
        status: "requested",
        shipping_address: shippingAddress || null,
      })
      .select()
      .single();

    if (redemptionError) {
      return NextResponse.json(
        { error: "Failed to create redemption" },
        { status: 500 }
      );
    }

    // Deduct points from user
    const newBalance = user.points_balance - totalPoints;
    const { error: updateUserError } = await supabase
      .from("user_profiles")
      .update({ points_balance: newBalance })
      .eq("id", userId);

    if (updateUserError) {
      // Rollback redemption if points deduction fails
      await supabase
        .from("redemptions")
        .delete()
        .eq("id", redemption.id);

      return NextResponse.json(
        { error: "Failed to deduct points" },
        { status: 500 }
      );
    }

    // Create point transaction record
    const { error: transactionError } = await supabase
      .from("point_transactions")
      .insert({
        user_id: userId,
        type: "spent",
        points: -totalPoints,
        balance_after: newBalance,
        reference_type: "redemption",
        reference_id: redemption.id,
        description: `แลกรางวัล: ${reward.name}`,
        created_by: userId,
      });

    if (transactionError) {
      console.error("Failed to create transaction record:", transactionError);
      // Don't rollback, just log the error
    }

    return NextResponse.json({
      success: true,
      redemption,
      newBalance,
    });
  } catch (error) {
    console.error("Redemption error:", error);
    return NextResponse.json(
      { error: "Failed to redeem reward" },
      { status: 500 }
    );
  }
}
