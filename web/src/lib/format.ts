import type { Metric } from "./types";

export function formatValue(value: number, metric: Metric): string {
  switch (metric) {
    case "total_tokens":
      return `${value.toLocaleString()} tokens`;
    case "estimated_cost_usd":
      return `~$${value.toFixed(4)}`;
    case "session_count":
      return `${value} sessions`;
    case "usage_minutes":
      if (value >= 60) {
        const h = Math.floor(value / 60);
        const m = Math.round(value % 60);
        return `${h}h ${m}m`;
      }
      return `${Math.round(value)}m`;
    default:
      return String(value);
  }
}

export function formatRankChange(change: number): {
  text: string;
  color: string;
} {
  if (change > 0) return { text: `▲${change}`, color: "text-green-500" };
  if (change < 0) return { text: `▼${Math.abs(change)}`, color: "text-red-500" };
  return { text: "-", color: "text-gray-500" };
}

export const METRIC_LABELS: Record<Metric, string> = {
  total_tokens: "토큰",
  estimated_cost_usd: "예상비용 ⚠️",
  session_count: "세션수",
  usage_minutes: "사용시간",
};

export const PERIOD_LABELS = {
  today: "오늘",
  "7d": "7일",
  all: "전체",
};
