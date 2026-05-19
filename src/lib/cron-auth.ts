import { NextRequest } from "next/server";

export function verifyCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[CRON] CRON_SECRET is not configured");
    return false;
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}
