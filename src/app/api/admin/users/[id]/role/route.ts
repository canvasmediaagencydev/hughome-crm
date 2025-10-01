import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface ChangeRoleRequest {
  role: "contractor" | "homeowner";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: ChangeRoleRequest = await request.json();
    const { role } = body;

    if (!role || !["contractor", "homeowner"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be 'contractor' or 'homeowner'" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from("user_profiles")
      .select("id, role")
      .eq("id", id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user role
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ role })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update user role" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      role,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to change role" },
      { status: 500 }
    );
  }
}
