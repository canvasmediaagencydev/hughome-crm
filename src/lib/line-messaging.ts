const LINE_API_BASE = "https://api.line.me/v2/bot";

function getToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  }
  return token;
}

async function lineRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const res = await fetch(`${LINE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export async function createLineAudience(description: string): Promise<number> {
  const res = await lineRequest("POST", "/audienceGroup/upload", {
    description,
    isIfaAudience: false,
    audiences: [],
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE createAudience failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.audienceGroupId as number;
}

export async function addUsersToAudience(
  audienceGroupId: number,
  lineUserIds: string[]
): Promise<void> {
  const BATCH_SIZE = 10_000;
  for (let i = 0; i < lineUserIds.length; i += BATCH_SIZE) {
    const batch = lineUserIds.slice(i, i + BATCH_SIZE);
    const res = await lineRequest("PUT", "/audienceGroup/upload", {
      audienceGroupId,
      audiences: batch.map((id) => ({ id })),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LINE addUsersToAudience failed (${res.status}): ${text}`);
    }
  }
}

export async function deleteLineAudience(
  audienceGroupId: number
): Promise<void> {
  const res = await lineRequest(
    "DELETE",
    `/audienceGroup/${audienceGroupId}`
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE deleteAudience failed (${res.status}): ${text}`);
  }
}

export interface LineAudienceGroup {
  audienceGroupId: number;
  description: string;
  status: string;
  audienceCount: number;
  created: number;
  type: string;
  createRoute: string;
  permission: string;
}

export async function listLineAudiences(): Promise<LineAudienceGroup[]> {
  const all: LineAudienceGroup[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await lineRequest(
      "GET",
      `/audienceGroup/list?page=${page}&size=40`
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LINE listAudiences failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    all.push(...(data.audienceGroups ?? []));
    hasNextPage = data.hasNextPage ?? false;
    page++;
  }

  return all;
}

export async function resyncAudience(
  description: string,
  lineUserIds: string[]
): Promise<number | null> {
  if (lineUserIds.length === 0) {
    return null;
  }

  const newId = await createLineAudience(description);
  if (lineUserIds.length > 0) {
    await addUsersToAudience(newId, lineUserIds);
  }
  return newId;
}

// ─────────────────────────────────────────────────────────────
// Push Message (notifications to individual users)
// ─────────────────────────────────────────────────────────────

type LineMessage = Record<string, unknown>;

export async function pushMessage(
  toLineUserId: string,
  messages: LineMessage[]
): Promise<void> {
  if (!toLineUserId) return;

  const res = await lineRequest("POST", "/message/push", {
    to: toLineUserId,
    messages,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE pushMessage failed (${res.status}): ${text}`);
  }
}

export type PointNotificationKind =
  | "receipt_approved"
  | "points_bonus"
  | "points_refund"
  | "points_spent";

interface PointNotificationInput {
  kind: PointNotificationKind;
  pointsDelta: number;
  newBalance: number;
}

const KIND_META: Record<
  PointNotificationKind,
  { title: string; emoji: string; color: string; deltaLabel: string }
> = {
  receipt_approved: {
    title: "อนุมัติใบเสร็จแล้ว",
    emoji: "✅",
    color: "#16A34A",
    deltaLabel: "ได้รับแต้ม",
  },
  points_bonus: {
    title: "ได้รับแต้มโบนัส",
    emoji: "🎉",
    color: "#16A34A",
    deltaLabel: "ได้รับแต้ม",
  },
  points_refund: {
    title: "คืนแต้ม",
    emoji: "↩️",
    color: "#0EA5E9",
    deltaLabel: "คืนแต้ม",
  },
  points_spent: {
    title: "แต้มถูกหัก",
    emoji: "⚠️",
    color: "#DC2626",
    deltaLabel: "หักแต้ม",
  },
};

function formatPoints(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.abs(n));
}

function buildPointFlex(input: PointNotificationInput): LineMessage {
  const meta = KIND_META[input.kind];
  const sign = input.pointsDelta >= 0 ? "+" : "-";
  const deltaText = `${sign}${formatPoints(input.pointsDelta)}`;

  const bodyContents: LineMessage[] = [
    {
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "text",
          text: meta.deltaLabel,
          size: "sm",
          color: "#6B7280",
          flex: 0,
        },
        {
          type: "text",
          text: `${deltaText} แต้ม`,
          size: "lg",
          weight: "bold",
          color: meta.color,
          align: "end",
        },
      ],
    },
    {
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "text",
          text: "ยอดคงเหลือ",
          size: "sm",
          color: "#6B7280",
          flex: 0,
        },
        {
          type: "text",
          text: `${formatPoints(input.newBalance)} แต้ม`,
          size: "md",
          weight: "bold",
          color: "#111827",
          align: "end",
        },
      ],
      margin: "md",
    },
  ];

  return {
    type: "flex",
    altText: `${meta.emoji} ${meta.title}: ${deltaText} แต้ม (คงเหลือ ${formatPoints(
      input.newBalance
    )})`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: meta.color,
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: `${meta.emoji} ${meta.title}`,
            color: "#FFFFFF",
            weight: "bold",
            size: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: bodyContents,
      },
    },
  };
}

export async function notifyPointChange(
  lineUserId: string | null | undefined,
  input: PointNotificationInput
): Promise<void> {
  if (!lineUserId) return;
  try {
    await pushMessage(lineUserId, [buildPointFlex(input)]);
  } catch (err) {
    // Fire-and-forget: don't fail the admin action if LINE push fails
    // (e.g. user blocked the OA or hasn't added it as a friend yet)
    console.error("[LINE] notifyPointChange failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// Birthday greeting
// ─────────────────────────────────────────────────────────────

function buildBirthdayFlex(displayName: string | null): LineMessage {
  const name = (displayName ?? "").trim();
  const greeting = name
    ? `สุขสันต์วันเกิดคุณ ${name} 🎂`
    : "สุขสันต์วันเกิด 🎂";

  return {
    type: "flex",
    altText: `${greeting} — ขอให้มีความสุขมากๆ`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#F472B6",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "🎉 HAPPY BIRTHDAY 🎉",
            color: "#FFFFFF",
            weight: "bold",
            size: "lg",
            align: "center",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: greeting,
            weight: "bold",
            size: "md",
            color: "#111827",
            wrap: true,
            align: "center",
          },
          {
            type: "text",
            text: "ขอให้ปีนี้เป็นปีที่ดีและมีความสุขกับ Hughome นะคะ 💝",
            size: "sm",
            color: "#6B7280",
            wrap: true,
            margin: "md",
            align: "center",
          },
        ],
      },
    },
  };
}

export async function notifyBirthday(
  lineUserId: string | null | undefined,
  displayName: string | null
): Promise<void> {
  if (!lineUserId) return;
  try {
    await pushMessage(lineUserId, [buildBirthdayFlex(displayName)]);
  } catch (err) {
    console.error("[LINE] notifyBirthday failed:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// Points expiry warning + executed
// ─────────────────────────────────────────────────────────────

function formatThaiDate(d: Date): string {
  // e.g. "10 พฤษภาคม 2026"
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(d);
}

interface ExpiryWarningInput {
  pointsBalance: number;
  expireAt: Date;
  daysLeft: number;
}

function buildExpiryWarningFlex(input: ExpiryWarningInput): LineMessage {
  const dateText = formatThaiDate(input.expireAt);
  const urgent = input.daysLeft <= 3;
  const color = urgent ? "#DC2626" : "#F59E0B";

  return {
    type: "flex",
    altText: `⏰ แต้มจะหมดอายุใน ${input.daysLeft} วัน (${formatPoints(
      input.pointsBalance
    )} แต้ม)`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: color,
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: `⏰ แต้มใกล้หมดอายุ`,
            color: "#FFFFFF",
            weight: "bold",
            size: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "แต้มคงเหลือ",
                size: "sm",
                color: "#6B7280",
                flex: 0,
              },
              {
                type: "text",
                text: `${formatPoints(input.pointsBalance)} แต้ม`,
                size: "lg",
                weight: "bold",
                color: "#111827",
                align: "end",
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "จะหมดอายุ",
                size: "sm",
                color: "#6B7280",
                flex: 0,
              },
              {
                type: "text",
                text: dateText,
                size: "md",
                weight: "bold",
                color: color,
                align: "end",
              },
            ],
            margin: "md",
          },
          {
            type: "text",
            text:
              input.daysLeft === 1
                ? "เหลือเวลาอีก 1 วันสุดท้าย รีบใช้แต้มก่อนหมดอายุนะคะ"
                : `เหลือเวลาอีก ${input.daysLeft} วัน รีบแลกของรางวัลกันได้เลย`,
            size: "sm",
            color: "#374151",
            wrap: true,
            margin: "lg",
          },
        ],
      },
    },
  };
}

export async function notifyExpiryWarning(
  lineUserId: string | null | undefined,
  input: ExpiryWarningInput
): Promise<void> {
  if (!lineUserId) return;
  try {
    await pushMessage(lineUserId, [buildExpiryWarningFlex(input)]);
  } catch (err) {
    console.error("[LINE] notifyExpiryWarning failed:", err);
  }
}

interface ExpiryExecutedInput {
  expiredPoints: number;
  nextExpireAt: Date;
}

function buildExpiryExecutedFlex(input: ExpiryExecutedInput): LineMessage {
  const dateText = formatThaiDate(input.nextExpireAt);
  return {
    type: "flex",
    altText: `แต้ม ${formatPoints(input.expiredPoints)} แต้มหมดอายุแล้ว`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#6B7280",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: "แต้มหมดอายุแล้ว",
            color: "#FFFFFF",
            weight: "bold",
            size: "md",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "แต้มที่หมดอายุ",
                size: "sm",
                color: "#6B7280",
                flex: 0,
              },
              {
                type: "text",
                text: `-${formatPoints(input.expiredPoints)} แต้ม`,
                size: "lg",
                weight: "bold",
                color: "#DC2626",
                align: "end",
              },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "รอบถัดไป",
                size: "sm",
                color: "#6B7280",
                flex: 0,
              },
              {
                type: "text",
                text: dateText,
                size: "md",
                weight: "bold",
                color: "#111827",
                align: "end",
              },
            ],
            margin: "md",
          },
          {
            type: "text",
            text: "เริ่มสะสมแต้มใหม่ได้เลย แต้มจะหมดอายุอีกครั้งในวันครบรอบสมัครปีถัดไป",
            size: "xs",
            color: "#9CA3AF",
            wrap: true,
            margin: "lg",
          },
        ],
      },
    },
  };
}

export async function notifyExpiryExecuted(
  lineUserId: string | null | undefined,
  input: ExpiryExecutedInput
): Promise<void> {
  if (!lineUserId) return;
  try {
    await pushMessage(lineUserId, [buildExpiryExecutedFlex(input)]);
  } catch (err) {
    console.error("[LINE] notifyExpiryExecuted failed:", err);
  }
}
