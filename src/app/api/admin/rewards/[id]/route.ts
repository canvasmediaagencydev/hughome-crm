import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";
import { TablesUpdate } from "../../../../../../database.types";

type RewardUpdate = TablesUpdate<"rewards">;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ต้องมี rewards.edit permission
  await requirePermission(PERMISSIONS.REWARDS_EDIT);
  try {
    const supabase = createServerSupabaseClient();
    const { id } = await params;
    const updates: RewardUpdate = await request.json();

    const { data: reward, error } = await supabase
      .from("rewards")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(reward);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update reward" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ต้องมี rewards.delete permission
  await requirePermission(PERMISSIONS.REWARDS_DELETE);

  try {
    const supabase = createServerSupabaseClient();
    const { id } = await params;
    const { count, error: redemptionError } = await supabase
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('reward_id', id)
      .neq('status', 'cancelled');

    if (redemptionError) {
      return NextResponse.json({ error: redemptionError.message }, { status: 500 });
    }

    if ((count || 0) > 0) {
      const { error: archiveError } = await supabase
        .from('rewards')
        .update({ is_archived: true })
        .eq('id', id);

      if (archiveError) {
        return NextResponse.json({ error: archiveError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, archived: true });
    }

    const { error } = await supabase
      .from("rewards")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, archived: false });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete reward" },
      { status: 500 }
    );
  }
}
