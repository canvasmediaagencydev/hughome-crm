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
