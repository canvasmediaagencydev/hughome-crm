import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Tables, TablesInsert } from "../../../../../database.types";

type Reward = Tables<"rewards">;
type RewardInsert = TablesInsert<"rewards">;

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Fetch all rewards
    const { data: rewards, error } = await supabase
      .from("rewards")
      .select("*")
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
      // Continue without redemptions data
    }

    // Calculate remaining stock for each reward
    const rewardsWithStock = rewards?.map(reward => {
      // If no stock limit, return as is
      if (reward.stock_quantity === null) {
        return {
          ...reward,
          remaining_stock: null,
          redeemed_count: 0
        };
      }

      // Calculate total redeemed quantity for this reward
      const redeemedCount = redemptions
        ?.filter(r => r.reward_id === reward.id)
        .reduce((sum, r) => sum + (r.quantity || 1), 0) || 0;

      const remainingStock = reward.stock_quantity - redeemedCount;

      return {
        ...reward,
        remaining_stock: Math.max(0, remainingStock), // Don't go below 0
        redeemed_count: redeemedCount
      };
    });

    return NextResponse.json(rewardsWithStock);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch rewards" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body: RewardInsert = await request.json();

    const { data: reward, error } = await supabase
      .from("rewards")
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(reward, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create reward" },
      { status: 500 }
    );
  }
}
