import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import type { ProfileResponse, Metric } from "@/lib/types";
import { formatValue, METRIC_LABELS } from "@/lib/format";
import ProfileClient from "./ProfileClient";

interface Props {
  params: Promise<{ nickname: string }>;
}

async function getProfile(nickname: string): Promise<ProfileResponse | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/profile/${encodeURIComponent(nickname)}`,
      { next: { revalidate: 60 } }
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("fetch failed");
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nickname } = await params;
  return {
    title: `${decodeURIComponent(nickname)} — AI Challenge Leaderboard`,
    description: `${decodeURIComponent(nickname)}의 Claude Code 사용량 프로필`,
  };
}

function RankCard({
  label,
  today,
  allTime,
}: {
  label: string;
  today: number;
  allTime: number;
}) {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-end gap-3">
        <div>
          <p className="text-xs text-gray-600 mb-0.5">오늘</p>
          <p className="text-2xl font-bold tabular-nums">
            {today > 0 ? `#${today}` : <span className="text-gray-600">-</span>}
          </p>
        </div>
        <div className="pb-1 text-gray-600">/</div>
        <div>
          <p className="text-xs text-gray-600 mb-0.5">전체</p>
          <p className="text-2xl font-bold tabular-nums text-gray-400">
            {allTime > 0 ? `#${allTime}` : <span className="text-gray-600">-</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  summary,
}: {
  title: string;
  summary: Record<Metric, number>;
}) {
  const metrics: Metric[] = [
    "total_tokens",
    "estimated_cost_usd",
    "session_count",
    "usage_minutes",
  ];
  return (
    <div className="bg-[#111111] border border-[#222222] rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">
        {title}
      </p>
      <div className="space-y-2">
        {metrics.map((m) => (
          <div key={m} className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{METRIC_LABELS[m]}</span>
            <span className="text-sm font-mono tabular-nums text-gray-200">
              {formatValue(summary[m] ?? 0, m)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ProfilePage({ params }: Props) {
  const { nickname } = await params;
  const decodedNickname = decodeURIComponent(nickname);
  const profile = await getProfile(decodedNickname);

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-6xl mb-6">🔍</p>
          <h1 className="text-2xl font-bold mb-3">사용자를 찾을 수 없습니다</h1>
          <p className="text-gray-400 mb-6 text-sm">
            <span className="font-mono text-gray-300">{decodedNickname}</span> 닉네임의
            사용자가 존재하지 않거나 아직 데이터가 없습니다.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-full text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            ← 리더보드로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  const rankMetrics: { key: Metric; label: string }[] = [
    { key: "total_tokens", label: METRIC_LABELS.total_tokens },
    { key: "estimated_cost_usd", label: METRIC_LABELS.estimated_cost_usd },
    { key: "session_count", label: METRIC_LABELS.session_count },
    { key: "usage_minutes", label: METRIC_LABELS.usage_minutes },
  ];

  const registeredDate = new Date(profile.registered_at).toLocaleDateString(
    "ko-KR",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm mb-8 transition-colors"
        >
          ← 리더보드
        </Link>

        {/* Profile Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">{profile.nickname}</h1>
            <p className="text-gray-500 text-sm">등록일: {registeredDate}</p>
          </div>
          {/* Share button - client component */}
          <ProfileClient nickname={profile.nickname} />
        </div>

        {/* Rank Cards */}
        <section className="mb-8">
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-medium">
            순위
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {rankMetrics.map(({ key, label }) => (
              <RankCard
                key={key}
                label={label}
                today={profile.ranks[key].today}
                allTime={profile.ranks[key].all_time}
              />
            ))}
          </div>
        </section>

        {/* Chart */}
        <section className="mb-8">
          <ProfileChartWrapper records={profile.daily_records} />
        </section>

        {/* Summary Cards */}
        <section>
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-medium">
            요약
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard title="오늘" summary={profile.summary.today as Record<Metric, number>} />
            <SummaryCard title="7일 합계" summary={profile.summary["7d_total"] as Record<Metric, number>} />
            <SummaryCard title="7일 평균" summary={profile.summary["7d_avg"] as Record<Metric, number>} />
          </div>
        </section>
      </div>
    </main>
  );
}

// Lazy wrapper to avoid direct recharts import in server component
function ProfileChartWrapper({
  records,
}: {
  records: ProfileResponse["daily_records"];
}) {
  // This is a server component — delegate rendering to client component
  return <ChartSection records={records} />;
}

// Inline client wrapper for chart (keeps server component boundary clean)
import ChartSection from "./ChartSection";
