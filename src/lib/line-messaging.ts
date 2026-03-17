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
