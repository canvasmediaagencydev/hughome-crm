import { NextResponse } from "next/server";

export async function GET() {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "LINE_CHANNEL_ACCESS_TOKEN not set" }, { status: 500 });
    }

    // ทดสอบ create audience
    const res = await fetch("https://api.line.me/v2/bot/audienceGroup/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: "__debug_test__",
        isIfaAudience: false,
        audiences: [],
      }),
    });

    const body = await res.json();

    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      tokenPrefix: token.substring(0, 20) + "...",
      lineResponse: body,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
