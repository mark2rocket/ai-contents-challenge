import { createReadStream, existsSync } from "fs";
import { readdir, stat } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { createInterface } from "readline";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname_esm = dirname(fileURLToPath(import.meta.url));

interface AssistantRecord {
  type: "assistant";
  timestamp: string;
  sessionId: string;
  message: {
    model: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation?: {
        ephemeral_5m_input_tokens?: number;
        ephemeral_1h_input_tokens?: number;
      };
    };
  };
}

export interface ParseResult {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  session_count: number;
  usage_minutes: number;
}

type PricingTable = Record<
  string,
  { input: number; output: number; cache_read: number; cache_write: number }
>;

function loadPricing(): PricingTable {
  try {
    const pricingPath = join(__dirname_esm, "../../pricing.json");
    return JSON.parse(readFileSync(pricingPath, "utf-8")) as PricingTable;
  } catch {
    return {};
  }
}

function calcCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens: number,
  pricing: PricingTable
): number {
  const p = pricing[model];
  if (!p) {
    process.stderr.write(`[ai-challenge] 미인식 모델: ${model} (비용 0 처리)\n`);
    return 0;
  }
  return (
    (inputTokens / 1_000_000) * p.input +
    (outputTokens / 1_000_000) * p.output +
    (cacheReadTokens / 1_000_000) * p.cache_read +
    (cacheWriteTokens / 1_000_000) * p.cache_write
  );
}

async function findJsonlFiles(baseDir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      let s;
      try {
        s = await stat(fullPath);
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        await walk(fullPath);
      } else if (entry.endsWith(".jsonl")) {
        files.push(fullPath);
      }
    }
  }

  await walk(baseDir);
  return files;
}

async function parseJsonlFile(
  filePath: string,
  periodStart: Date,
  periodEnd: Date,
  pricing: PricingTable,
  sessionMap: Map<string, { first: Date; last: Date }>
): Promise<{
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  estimated_cost_usd: number;
}> {
  const result = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    estimated_cost_usd: 0,
  };

  return new Promise((resolve, reject) => {
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      if (!line.trim()) return;
      let record: unknown;
      try {
        record = JSON.parse(line);
      } catch {
        return;
      }

      const r = record as Record<string, unknown>;
      if (r["type"] !== "assistant") return;

      const timestamp = new Date(r["timestamp"] as string);
      if (isNaN(timestamp.getTime())) return;
      if (timestamp < periodStart || timestamp >= periodEnd) return;

      const ar = r as unknown as AssistantRecord;
      const usage = ar.message?.usage;
      if (!usage) return;

      const sessionId = ar.sessionId || "unknown";
      const prev = sessionMap.get(sessionId);
      if (!prev) {
        sessionMap.set(sessionId, { first: timestamp, last: timestamp });
      } else {
        if (timestamp < prev.first) prev.first = timestamp;
        if (timestamp > prev.last) prev.last = timestamp;
      }

      const inputTok = usage.input_tokens || 0;
      const outputTok = usage.output_tokens || 0;
      const cacheReadTok = usage.cache_read_input_tokens || 0;

      // cache_write: cache_creation_input_tokens 또는 cache_creation 객체 합산
      let cacheWriteTok = usage.cache_creation_input_tokens || 0;
      if (usage.cache_creation && typeof usage.cache_creation === "object") {
        const cc = usage.cache_creation as {
          ephemeral_5m_input_tokens?: number;
          ephemeral_1h_input_tokens?: number;
        };
        cacheWriteTok =
          (cc.ephemeral_5m_input_tokens || 0) +
          (cc.ephemeral_1h_input_tokens || 0);
      }

      result.input_tokens += inputTok;
      result.output_tokens += outputTok;
      result.cache_read_tokens += cacheReadTok;
      result.cache_write_tokens += cacheWriteTok;
      result.estimated_cost_usd += calcCost(
        ar.message.model,
        inputTok,
        outputTok,
        cacheReadTok,
        cacheWriteTok,
        pricing
      );
    });

    rl.on("close", () => resolve(result));
    rl.on("error", reject);
  });
}

const SESSION_GAP_MS = 30 * 60 * 1000; // 30분

function calcUsageMinutes(
  sessionMap: Map<string, { first: Date; last: Date }>
): number {
  let totalMs = 0;
  for (const { first, last } of sessionMap.values()) {
    const diffMs = last.getTime() - first.getTime();
    // 30분 초과 gap은 세션 자체를 30분으로 캡
    totalMs += Math.min(diffMs, SESSION_GAP_MS);
  }
  return totalMs / 60_000;
}

export async function parseClaudeLogs(
  periodStart: Date,
  periodEnd: Date
): Promise<ParseResult> {
  const projectsDir = join(homedir(), ".claude", "projects");

  if (!existsSync(projectsDir)) {
    throw new Error(
      `Claude Code 로그를 찾을 수 없습니다. Claude Code를 한 번 이상 실행한 후 다시 시도하세요.\n경로: ${projectsDir}`
    );
  }

  const pricing = loadPricing();
  const files = await findJsonlFiles(projectsDir);

  const sessionMap = new Map<string, { first: Date; last: Date }>();
  let input_tokens = 0;
  let output_tokens = 0;
  let cache_read_tokens = 0;
  let cache_write_tokens = 0;
  let estimated_cost_usd = 0;

  for (const file of files) {
    const r = await parseJsonlFile(
      file,
      periodStart,
      periodEnd,
      pricing,
      sessionMap
    );
    input_tokens += r.input_tokens;
    output_tokens += r.output_tokens;
    cache_read_tokens += r.cache_read_tokens;
    cache_write_tokens += r.cache_write_tokens;
    estimated_cost_usd += r.estimated_cost_usd;
  }

  const total_tokens =
    input_tokens + output_tokens + cache_read_tokens + cache_write_tokens;
  const session_count = sessionMap.size;
  const usage_minutes = parseFloat(calcUsageMinutes(sessionMap).toFixed(1));

  return {
    input_tokens,
    output_tokens,
    cache_read_tokens,
    cache_write_tokens,
    total_tokens,
    estimated_cost_usd: parseFloat(estimated_cost_usd.toFixed(6)),
    session_count,
    usage_minutes,
  };
}
