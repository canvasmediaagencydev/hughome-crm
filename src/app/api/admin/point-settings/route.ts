import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Tables, TablesInsert, TablesUpdate } from "../../../../../database.types";

type PointSetting = Tables<"point_settings">;
type PointSettingInsert = TablesInsert<"point_settings">;
type PointSettingUpdate = TablesUpdate<"point_settings">;

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    const { data: settings, error } = await supabase
      .from("point_settings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch point settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body: PointSettingInsert = await request.json();

    const { data: setting, error } = await supabase
      .from("point_settings")
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(setting, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create point setting" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { id, ...updates }: { id: string } & PointSettingUpdate = await request.json();

    const { data: setting, error } = await supabase
      .from("point_settings")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(setting);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update point setting" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("point_settings")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete point setting" },
      { status: 500 }
    );
  }
}