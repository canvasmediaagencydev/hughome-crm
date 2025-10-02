import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Tables, TablesInsert } from "../../../../../database.types";

type Reward = Tables<"rewards">;
type RewardInsert = TablesInsert<"rewards">;

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const offset = (page - 1) * limit;

    // Count total rewards
    const { count, error: countError } = await supabase
      .from("rewards")
      .select("*", { count: 'exact', head: true });

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // Fetch paginated rewards
    const { data: rewards, error } = await supabase
      .from("rewards")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

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

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      rewards: rewardsWithStock,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    });
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
