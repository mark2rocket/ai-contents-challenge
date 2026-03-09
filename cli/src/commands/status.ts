import { readConfig, readLastSync, readQueue } from "../lib/config.js";

function minutesUntilNextHour(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return Math.round((next.getTime() - now.getTime()) / 60_000);
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function status(): Promise<void> {
  console.log("AI Challenge 상태\n");

  const config = await readConfig();
  if (!config) {
    console.log("등록되지 않았습니다.");
    console.log("  → 'ai-challenge init' 을 실행하여 등록하세요.");
    return;
  }

  console.log(`닉네임  : ${config.nickname}`);
  console.log(`서버    : ${config.server_url}`);
  console.log(`등록일  : ${formatDate(config.registered_at)}`);
  console.log();

  const lastSync = await readLastSync();
  if (lastSync) {
    console.log(`마지막 전송: ${formatDate(lastSync.synced_at)}`);
    console.log(
      `  기간: ${formatDate(lastSync.period_start)} ~ ${formatDate(lastSync.period_end)}`
    );
  } else {
    console.log("마지막 전송: 없음 (아직 전송하지 않았습니다)");
  }

  const minutesLeft = minutesUntilNextHour();
  console.log(`다음 자동 전송: 약 ${minutesLeft}분 후 (다음 정각)`);
  console.log();

  const queue = await readQueue();
  if (queue.length > 0) {
    const retryable = queue.filter((q) => q.attempts < 3);
    const expired = queue.filter((q) => q.attempts >= 3);
    console.log(`대기 중인 항목: ${queue.length}개`);
    if (retryable.length > 0) {
      console.log(`  재시도 가능: ${retryable.length}개`);
    }
    if (expired.length > 0) {
      console.log(`  재시도 초과 (폐기 예정): ${expired.length}개`);
    }
    console.log("  → 'ai-challenge sync' 실행 시 재전송을 시도합니다.");
  } else {
    console.log("대기 중인 항목: 없음");
  }
}
