"use client";

import { useState } from "react";
import type { DailyRecord, Metric } from "@/lib/types";
import UsageChart from "./UsageChart";

interface ChartSectionProps {
  records: DailyRecord[];
}

export default function ChartSection({ records }: ChartSectionProps) {
  const [metric, setMetric] = useState<Metric>("total_tokens");

  return (
    <UsageChart
      records={records}
      metric={metric}
      onMetricChange={setMetric}
    />
  );
}
