import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";
import { parseISO, startOfDay, endOfDay, format } from "date-fns";
import * as XLSX from "xlsx";

function formatThaiDate(dateString: string): string {
  const date = new Date(dateString);
  const buddhistYear = date.getFullYear() + 543;
  const formatted = format(date, "dd/MM/yyyy HH:mm");
  return formatted.replace(String(date.getFullYear()), String(buddhistYear));
}

function formatPhone(phone: string | null): string {
  if (!phone) return "-";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.USERS_VIEW);

    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required parameters: start and end" },
        { status: 400 }
      );
    }

    let start: Date;
    let end: Date;
    try {
      start = startOfDay(parseISO(startDate));
      end = endOfDay(parseISO(endDate));
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("Invalid date");
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    const { data: users, error } = await supabase
      .from("user_profiles")
      .select("created_at, first_name, last_name, phone, points_balance")
      .not("role", "is", null)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database query error:", error);
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }

    // สร้างข้อมูลสำหรับ Excel
    const headers = ["ลำดับ", "วันที่สมัคร", "ชื่อจริง", "นามสกุล", "เบอร์โทร", "แต้มปัจจุบัน"];

    const rows = (users || []).map((user, index) => [
      index + 1,
      formatThaiDate(user.created_at),
      user.first_name || "-",
      user.last_name || "-",
      formatPhone(user.phone),
      user.points_balance ?? 0,
    ]);

    // สร้าง workbook และ worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // กำหนดความกว้าง column
    ws["!cols"] = [
      { wch: 8 },   // ลำดับ
      { wch: 18 },  // วันที่สมัคร
      { wch: 15 },  // ชื่อจริง
      { wch: 15 },  // นามสกุล
      { wch: 14 },  // เบอร์โทร
      { wch: 12 },  // แต้มปัจจุบัน
    ];

    XLSX.utils.book_append_sheet(wb, ws, "รายงานลูกค้า");

    // สร้างไฟล์ Excel
    const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `users-report-${startDate}-to-${endDate}.xlsx`;

    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: unknown) {
    console.error("Excel generation error:", error);

    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to generate Excel" },
      { status: 500 }
    );
  }
}
