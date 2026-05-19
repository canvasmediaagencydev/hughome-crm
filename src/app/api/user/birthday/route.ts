import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface UpdateBirthdayBody {
  line_user_id: string;
  birthday: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdateBirthdayBody = await request.json();
    const { line_user_id, birthday } = body;

    if (!line_user_id) {
      return NextResponse.json({ error: "line_user_id required" }, { status: 400 });
    }

    let normalized: string | null = null;
    if (birthday) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
        return NextResponse.json(
          { error: "Invalid birthday format (expected YYYY-MM-DD)" },
          { status: 400 }
        );
      }
      normalized = birthday;
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("user_profiles")
      .update({ birthday: normalized, updated_at: new Date().toISOString() })
      .eq("line_user_id", line_user_id)
      .select("id, birthday")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Failed to update birthday" }, { status: 500 });
    }

    return NextResponse.json({ success: true, birthday: data.birthday });
  } catch (err) {
    console.error("Update birthday error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
