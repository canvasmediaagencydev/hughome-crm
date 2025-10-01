import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Tables, TablesInsert } from "../../../../../database.types";

type Reward = Tables<"rewards">;
type RewardInsert = TablesInsert<"rewards">;

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    const { data: rewards, error } = await supabase
      .from("rewards")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(rewards);
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
