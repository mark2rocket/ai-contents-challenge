import type { RecordPayload } from "./config.js";

export interface RecordResponse {
  recorded: boolean;
  period_start: string;
  already_existed: boolean;
}

export interface RegisterResponse {
  api_key: string;
  nickname: string;
  registered_at: string;
}

export async function registerUser(
  serverUrl: string,
  nickname: string
): Promise<RegisterResponse> {
  const url = `${serverUrl}/api/v1/register`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`등록 실패 (${res.status}): ${body}`);
  }

  return (await res.json()) as RegisterResponse;
}

export async function sendRecord(
  serverUrl: string,
  apiKey: string,
  payload: RecordPayload
): Promise<RecordResponse> {
  const url = `${serverUrl}/api/v1/record`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`전송 실패 (${res.status}): ${body}`);
  }

  return (await res.json()) as RecordResponse;
}
