"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Period, Metric, LeaderboardResponse, RankingItem } from "@/lib/types";
import {
  formatValue,
  formatRankChange,
  METRIC_LABELS,
  PERIOD_LABELS,
} from "@/lib/format";

const PERIODS: Period[] = ["today", "7d", "all"];
const METRICS: Metric[] = [
  "total_tokens",
  "estimated_cost_usd",
  "session_count",
  "usage_minutes",
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl">👑</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return (
    <span className="tabular-nums text-gray-400 font-mono text-sm w-6 text-center">
      {rank}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[#222222]">
      <td className="px-4 py-3">
        <div className="w-6 h-5 bg-[#1a1a1a] rounded animate-pulse" />
      </td>
      <td className="px-4 py-3">
        <div className="w-32 h-5 bg-[#1a1a1a] rounded animate-pulse" />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="w-24 h-5 bg-[#1a1a1a] rounded animate-pulse ml-auto" />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="w-10 h-5 bg-[#1a1a1a] rounded animate-pulse ml-auto" />
      </td>
    </tr>
  );
}

function CostTooltip() {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="relative"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 text-xs bg-[#1a1a1a] border border-[#333] text-gray-300 rounded px-3 py-2 z-50 whitespace-normal text-center pointer-events-none">
          Max 플랜 사용자에게는 실제 비용과 다를 수 있습니다
        </span>
      )}
    </span>
  );
}

function LeaderboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [period, setPeriod] = useState<Period>("today");
  const [metric, setMetric] = useState<Metric>("total_tokens");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // URL ?nickname= 파라미터 감지 시 localStorage 저장
  useEffect(() => {
    const nicknameFromUrl = searchParams.get("nickname");
    if (nicknameFromUrl) {
      localStorage.setItem("ai-challenge-nickname", nicknameFromUrl);
      // URL에서 파라미터 제거
      router.replace("/");
    }
    const stored = localStorage.getItem("ai-challenge-nickname");
    setMyNickname(stored);
  }, [searchParams, router]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/leaderboard?period=${period}&metric=${metric}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const json: LeaderboardResponse = await res.json();
      setData(json);
      setUpdatedAt(json.updated_at);
    } catch {
      // silently keep old data on error
    } finally {
      setLoading(false);
    }
  }, [period, metric]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const rankings: RankingItem[] = data?.rankings ?? [];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            AI Challenge Leaderboard
          </h1>
          <p className="text-gray-400 text-sm">
            더 많이 쓰는 사람이 더 빠르게 성장합니다 🔥
          </p>
          {updatedAt && (
            <p className="text-gray-600 text-xs mt-2">
              마지막 업데이트:{" "}
              {new Date(updatedAt).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          )}
        </div>

        {/* Period Tabs */}
        <div className="flex gap-2 mb-4">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                period === p
                  ? "bg-white text-black"
                  : "border border-[#333333] text-gray-400 hover:border-[#555] hover:text-gray-200"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Metric Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {METRICS.map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                metric === m
                  ? "bg-white text-black"
                  : "border border-[#333333] text-gray-400 hover:border-[#555] hover:text-gray-200"
              }`}
            >
              {METRIC_LABELS[m]}
              {m === "estimated_cost_usd" && <CostTooltip />}
            </button>
          ))}
        </div>

        {/* Leaderboard Table */}
        <div className="rounded-xl border border-[#222222] overflow-hidden bg-[#111111]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#222222] text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left w-12">순위</th>
                <th className="px-4 py-3 text-left">닉네임</th>
                <th className="px-4 py-3 text-right">값</th>
                <th className="px-4 py-3 text-right w-16">변동</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))
              ) : rankings.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    데이터가 없습니다
                  </td>
                </tr>
              ) : (
                rankings.map((item) => {
                  const isMe =
                    myNickname &&
                    item.nickname.toLowerCase() === myNickname.toLowerCase();
                  const rankChange = formatRankChange(item.rank_change);

                  return (
                    <tr
                      key={item.nickname}
                      className={`border-b border-[#1a1a1a] transition-colors hover:bg-[#161616] ${
                        isMe ? "ring-1 ring-inset ring-blue-500 bg-blue-950/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center w-6">
                          <RankBadge rank={item.rank} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/profile/${encodeURIComponent(item.nickname)}`}
                          className="hover:underline hover:text-blue-400 transition-colors"
                        >
                          {item.nickname}
                          {isMe && (
                            <span className="ml-2 text-xs text-blue-400 font-medium">
                              (나)
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-mono text-sm text-gray-200">
                        {formatValue(item.value, metric)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums text-xs font-medium ${rankChange.color}`}
                      >
                        {rankChange.text}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-gray-600 text-xs">
          <p>
            닉네임 등록은 Claude Code 클라이언트에서 자동으로 이루어집니다.
          </p>
          {myNickname && (
            <p className="mt-1">
              내 닉네임:{" "}
              <Link
                href={`/profile/${encodeURIComponent(myNickname)}`}
                className="text-blue-500 hover:underline"
              >
                {myNickname}
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={null}>
      <LeaderboardContent />
    </Suspense>
  );
}
