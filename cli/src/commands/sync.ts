import {
  readConfig,
  readQueue,
  writeQueue,
  writeLastSync,
  type RecordPayload,
  type QueueItem,
} from "../lib/config.js";
import { parseClaudeLogs } from "../lib/log-parser.js";
import { sendRecord } from "../lib/api-client.js";

function getPeriodBoundaries(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  // 현재 정각
  const periodEnd = new Date(now);
  periodEnd.setMinutes(0, 0, 0);
  // 이전 정각
  const periodStart = new Date(periodEnd.getTime() - 60 * 60 * 1000);
  return { periodStart, periodEnd };
}

async function trySendWithQueue(
  serverUrl: string,
  apiKey: string,
  payload: RecordPayload
): Promise<void> {
  // 큐에서 재전송 시도 (attempts < 3)
  const queue = await readQueue();
  const remaining: QueueItem[] = [];

  for (const item of queue) {
    if (item.attempts >= 3) {
      console.log(
        `  큐 항목 폐기 (재시도 초과): ${item.payload.period_start}`
      );
      continue;
    }
    try {
      const res = await sendRecord(serverUrl, apiKey, item.payload);
      if (res.already_existed) {
        console.log(`  큐 항목 이미 기록됨: ${item.payload.period_start}`);
      } else {
        console.log(`  큐 항목 전송 성공: ${item.payload.period_start}`);
      }
    } catch (e) {
      console.warn(
        `  큐 항목 재전송 실패 (${item.attempts + 1}회): ${(e as Error).message}`
      );
      remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  // 현재 페이로드 전송
  try {
    const res = await sendRecord(serverUrl, apiKey, payload);
    if (res.already_existed) {
      console.log(`이미 기록된 기간입니다: ${payload.period_start}`);
    } else {
      console.log(`전송 성공!`);
      console.log(`  기간: ${payload.period_start} ~ ${payload.period_end}`);
      console.log(
        `  토큰: 입력 ${payload.input_tokens.toLocaleString()} / 출력 ${payload.output_tokens.toLocaleString()}`
      );
      console.log(
        `  캐시: 읽기 ${payload.cache_read_tokens.toLocaleString()} / 쓰기 ${payload.cache_write_tokens.toLocaleString()}`
      );
      console.log(
        `  예상 비용: $${payload.estimated_cost_usd.toFixed(4)}`
      );
      console.log(`  세션 수: ${payload.session_count}`);
      console.log(`  사용 시간: ${payload.usage_minutes}분`);
    }

    await writeLastSync({
      synced_at: new Date().toISOString(),
      period_start: payload.period_start,
      period_end: payload.period_end,
    });
  } catch (e) {
    console.error(`전송 실패: ${(e as Error).message}`);
    console.log("큐에 저장합니다. 다음 sync 시 재시도됩니다.");
    remaining.push({
      payload,
      attempts: 1,
      queued_at: new Date().toISOString(),
    });
  }

  await writeQueue(remaining);
}

export async function sync(): Promise<void> {
  const config = await readConfig();
  if (!config) {
    console.error(
      "설정이 없습니다. 먼저 'ai-challenge init' 을 실행하세요."
    );
    process.exit(1);
  }

  const { periodStart, periodEnd } = getPeriodBoundaries();

  console.log(
    `로그 파싱 중... (${periodStart.toISOString()} ~ ${periodEnd.toISOString()})`
  );

  let parseResult;
  try {
    parseResult = await parseClaudeLogs(periodStart, periodEnd);
  } catch (e) {
    console.error(`로그 파싱 실패: ${(e as Error).message}`);
    process.exit(1);
  }

  if (parseResult.total_tokens === 0) {
    console.log("이 기간의 사용 데이터가 없습니다. 전송을 건너뜁니다.");
    return;
  }

  const payload: RecordPayload = {
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    input_tokens: parseResult.input_tokens,
    output_tokens: parseResult.output_tokens,
    cache_read_tokens: parseResult.cache_read_tokens,
    cache_write_tokens: parseResult.cache_write_tokens,
    estimated_cost_usd: parseResult.estimated_cost_usd,
    session_count: parseResult.session_count,
    usage_minutes: parseResult.usage_minutes,
  };

  await trySendWithQueue(config.server_url, config.api_key, payload);
}
