import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";
import { parseISO, startOfDay, endOfDay, format } from "date-fns";
import ExcelJS from "exceljs";

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
    const role = searchParams.get("role"); // "contractor" | "homeowner" | null

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required parameters: start and end" },
        { status: 400 }
      );
    }

    if (role && role !== "contractor" && role !== "homeowner") {
      return NextResponse.json(
        { error: "Invalid role. Must be 'contractor' or 'homeowner'" },
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

    let query = supabase
      .from("user_profiles")
      .select("created_at, first_name, last_name, phone, points_balance, role")
      .not("role", "is", null)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });

    if (role) {
      query = query.eq("role", role);
    }

    const { data: users, error } = await query;

    if (error) {
      console.error("Database query error:", error);
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }

    const roleLabel = (r: string | null): string => {
      if (r === "contractor") return "ช่าง";
      if (r === "homeowner") return "เจ้าของบ้าน";
      return "-";
    };

    // สร้างข้อมูลสำหรับ Excel
    const headers = ["ลำดับ", "วันที่สมัคร", "ชื่อจริง", "นามสกุล", "เบอร์โทร", "ประเภท", "แต้มปัจจุบัน"];

    const rows = (users || []).map((user, index) => [
      index + 1,
      formatThaiDate(user.created_at),
      user.first_name || "-",
      user.last_name || "-",
      formatPhone(user.phone),
      roleLabel(user.role),
      user.points_balance ?? 0,
    ]);

    const sheetName = role === "contractor"
      ? "รายงานช่าง"
      : role === "homeowner"
      ? "รายงานเจ้าของบ้าน"
      : "รายงานลูกค้า";

    // สร้าง workbook และ worksheet
    const wb = new ExcelJS.Workbook();
    wb.creator = "HugHome CRM";
    const ws = wb.addWorksheet(sheetName);

    // กำหนดความกว้าง column
    ws.columns = [
      { width: 8 },   // ลำดับ
      { width: 18 },  // วันที่สมัคร
      { width: 15 },  // ชื่อจริง
      { width: 15 },  // นามสกุล
      { width: 14 },  // เบอร์โทร
      { width: 12 },  // ประเภท
      { width: 12 },  // แต้มปัจจุบัน
    ];

    ws.addRow(headers).font = { bold: true };
    rows.forEach((row) => ws.addRow(row));
    ws.views = [{ state: "frozen", ySplit: 1 }];

    // สร้างไฟล์ Excel
    const excelBuffer = await wb.xlsx.writeBuffer();

    const roleSuffix = role ? `-${role}` : "";
    const filename = `users-report-${startDate}-to-${endDate}${roleSuffix}.xlsx`;

    return new NextResponse(new Uint8Array(excelBuffer), {
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
