import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

export interface Config {
  nickname: string;
  api_key: string;
  registered_at: string;
  server_url: string;
}

export interface LastSync {
  synced_at: string;
  period_start: string;
  period_end: string;
}

export interface QueueItem {
  payload: RecordPayload;
  attempts: number;
  queued_at: string;
}

export interface RecordPayload {
  period_start: string;
  period_end: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  estimated_cost_usd: number;
  session_count: number;
  usage_minutes: number;
}

const CONFIG_DIR = join(homedir(), ".ai-challenge");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const LAST_SYNC_FILE = join(CONFIG_DIR, "last_sync.json");
const QUEUE_FILE = join(CONFIG_DIR, "queue.json");

async function ensureDir() {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

export async function readConfig(): Promise<Config | null> {
  try {
    const data = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function writeConfig(config: Config): Promise<void> {
  await ensureDir();
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function readLastSync(): Promise<LastSync | null> {
  try {
    const data = await readFile(LAST_SYNC_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function writeLastSync(sync: LastSync): Promise<void> {
  await ensureDir();
  await writeFile(LAST_SYNC_FILE, JSON.stringify(sync, null, 2));
}

export async function readQueue(): Promise<QueueItem[]> {
  try {
    const data = await readFile(QUEUE_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function writeQueue(queue: QueueItem[]): Promise<void> {
  await ensureDir();
  await writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2));
}
