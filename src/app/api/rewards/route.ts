import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Fetch active rewards only
    const { data: rewards, error } = await supabase
      .from("rewards")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch all redemptions (excluding cancelled)
    const { data: redemptions, error: redemptionsError } = await supabase
      .from("redemptions")
      .select("reward_id, quantity")
      .neq("status", "cancelled");

    if (redemptionsError) {
      console.error("Error fetching redemptions:", redemptionsError);
    }

    // Calculate remaining stock for each reward and filter out sold out items
    const availableRewards = rewards
      ?.map(reward => {
        // If no stock limit, it's always available
        if (reward.stock_quantity === null) {
          return {
            ...reward,
            remaining_stock: null,
            is_available: true
          };
        }

        // Calculate total redeemed quantity for this reward
        const redeemedCount = redemptions
          ?.filter(r => r.reward_id === reward.id)
          .reduce((sum, r) => sum + (r.quantity || 1), 0) || 0;

        const remainingStock = reward.stock_quantity - redeemedCount;

        return {
          ...reward,
          remaining_stock: Math.max(0, remainingStock),
          is_available: remainingStock > 0
        };
      })
      .filter(reward => reward.is_available); // Only show available rewards

    return NextResponse.json(availableRewards);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch rewards" },
      { status: 500 }
    );
  }
}
