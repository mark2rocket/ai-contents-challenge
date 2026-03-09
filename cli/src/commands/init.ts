import { createInterface } from "readline";
import { platform } from "os";
import { execSync } from "child_process";
import { readConfig, writeConfig } from "../lib/config.js";
import { registerUser } from "../lib/api-client.js";

const DEFAULT_SERVER_URL = "https://ai-challenge-leaderboard.vercel.app";
const NICKNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function getCronJobLine(cliPath: string): string {
  return `0 * * * * ${cliPath} sync >> ~/.ai-challenge/sync.log 2>&1`;
}

function hasCronJob(cliPath: string): boolean {
  try {
    const current = execSync("crontab -l 2>/dev/null || true", { encoding: "utf-8" });
    return current.includes(`${cliPath} sync`);
  } catch {
    return false;
  }
}

function setupCron(cliPath: string): void {
  if (hasCronJob(cliPath)) {
    console.log("  crontab에 이미 등록되어 있습니다.");
    return;
  }
  try {
    const current = execSync("crontab -l 2>/dev/null || true", { encoding: "utf-8" });
    const newLine = getCronJobLine(cliPath);
    const newCron = current.trimEnd() + (current.trim() ? "\n" : "") + newLine + "\n";
    execSync(`echo ${JSON.stringify(newCron)} | crontab -`);
    console.log(`  crontab 등록 완료: ${newLine}`);
  } catch (e) {
    console.warn(`  crontab 자동 등록 실패. 수동으로 추가하세요:`);
    console.warn(`    ${getCronJobLine(cliPath)}`);
  }
}

function getCliAbsPath(): string {
  try {
    const which = execSync("which ai-challenge 2>/dev/null || true", {
      encoding: "utf-8",
    }).trim();
    if (which) return which;
  } catch {
    // ignore
  }
  return "ai-challenge";
}

export async function init(): Promise<void> {
  const existing = await readConfig();
  if (existing) {
    console.log(`이미 등록되어 있습니다.`);
    console.log(`  닉네임: ${existing.nickname}`);
    console.log(`  서버: ${existing.server_url}`);
    console.log(`  등록일: ${existing.registered_at}`);
    console.log();
    console.log("재등록하려면 ~/.ai-challenge/config.json 을 삭제하고 다시 실행하세요.");
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("AI Challenge Leaderboard 초기 설정\n");

  let nickname = "";
  while (true) {
    nickname = await ask(rl, "닉네임을 입력하세요 (3-20자, 영문/숫자/_/-): ");
    if (nickname.length < 3 || nickname.length > 20) {
      console.log("  오류: 닉네임은 3-20자여야 합니다.");
      continue;
    }
    if (!NICKNAME_REGEX.test(nickname)) {
      console.log("  오류: 영문, 숫자, _, - 만 사용 가능합니다.");
      continue;
    }
    break;
  }

  const serverUrlInput = await ask(
    rl,
    `서버 URL (기본값: ${DEFAULT_SERVER_URL}): `
  );
  rl.close();

  const server_url = serverUrlInput || DEFAULT_SERVER_URL;

  console.log(`\n서버에 등록 중... (${server_url})`);

  let apiKey: string;
  let registeredAt: string;
  try {
    const res = await registerUser(server_url, nickname);
    apiKey = res.api_key;
    registeredAt = res.registered_at || new Date().toISOString();
    console.log(`등록 성공!`);
  } catch (e) {
    console.error(`등록 실패: ${(e as Error).message}`);
    process.exit(1);
  }

  await writeConfig({
    nickname,
    api_key: apiKey,
    registered_at: registeredAt,
    server_url,
  });

  console.log(`설정 저장 완료: ~/.ai-challenge/config.json`);
  console.log();

  const os = platform();
  if (os === "darwin" || os === "linux") {
    console.log("매 정각 자동 전송을 위해 crontab을 설정합니다...");
    const cliPath = getCliAbsPath();
    setupCron(cliPath);
  } else {
    console.log("Windows에서는 자동 전송 설정을 수동으로 구성해야 합니다.");
    console.log("작업 스케줄러에서 매 시간 다음 명령을 실행하도록 설정하세요:");
    console.log("  ai-challenge sync");
  }

  console.log();
  console.log("설정 완료!");
  console.log(`리더보드 확인: ${server_url}`);
  console.log();
  console.log("지금 바로 데이터를 전송하려면: ai-challenge sync");
}
