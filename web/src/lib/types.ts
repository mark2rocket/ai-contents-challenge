export type Period = "today" | "7d" | "all";
export type Metric = "total_tokens" | "estimated_cost_usd" | "session_count" | "usage_minutes";

export interface RankingItem {
  rank: number;
  nickname: string;
  value: number;
  rank_change: number;
}

export interface LeaderboardResponse {
  period: Period;
  metric: Metric;
  updated_at: string;
  rankings: RankingItem[];
}

export interface DailyRecord {
  date: string;
  total_tokens: number;
  estimated_cost_usd: number;
  session_count: number;
  usage_minutes: number;
}

export interface MetricSummary {
  total_tokens: number;
  estimated_cost_usd: number;
  session_count: number;
  usage_minutes: number;
}

export interface ProfileResponse {
  nickname: string;
  registered_at: string;
  ranks: {
    total_tokens: { today: number; all_time: number };
    estimated_cost_usd: { today: number; all_time: number };
    session_count: { today: number; all_time: number };
    usage_minutes: { today: number; all_time: number };
  };
  daily_records: DailyRecord[];
  summary: {
    today: MetricSummary;
    "7d_total": MetricSummary;
    "7d_avg": MetricSummary;
  };
}
