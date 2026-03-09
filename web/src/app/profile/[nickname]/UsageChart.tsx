"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DailyRecord, Metric } from "@/lib/types";
import { formatValue, METRIC_LABELS } from "@/lib/format";

interface UsageChartProps {
  records: DailyRecord[];
  metric: Metric;
  onMetricChange: (m: Metric) => void;
}

const METRICS: Metric[] = [
  "total_tokens",
  "estimated_cost_usd",
  "session_count",
  "usage_minutes",
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function UsageChart({
  records,
  metric,
  onMetricChange,
}: UsageChartProps) {
  const chartData = records.map((r) => ({
    date: formatDate(r.date),
    value: r[metric],
  }));

  return (
    <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">7일 일별 현황</h3>
        <div className="flex gap-1">
          {METRICS.map((m) => (
            <button
              key={m}
              onClick={() => onMetricChange(m)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                metric === m
                  ? "bg-white text-black"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickFormatter={(v: number) => {
              if (metric === "total_tokens" && v >= 1000)
                return `${(v / 1000).toFixed(0)}k`;
              if (metric === "estimated_cost_usd") return `$${v.toFixed(2)}`;
              return String(v);
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "12px",
            }}
            formatter={(value: number) => [
              formatValue(value, metric),
              METRIC_LABELS[metric],
            ]}
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
          />
          <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
