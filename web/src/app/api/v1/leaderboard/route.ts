import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type Period = 'today' | '7d' | 'all';
type Metric = 'total_tokens' | 'estimated_cost_usd' | 'session_count' | 'usage_minutes';

interface RankingRow {
  nickname: string;
  value: number;
}

async function getRankings(
  period: Period,
  metric: Metric,
  limit: number,
  referenceTime?: Date
): Promise<RankingRow[]> {
  const supabase = getSupabase();
  const refTime = referenceTime ?? new Date();

  // period별 시작 시각 계산
  let periodFilter: string | null = null;
  if (period === 'today') {
    const todayStart = new Date(refTime);
    todayStart.setHours(0, 0, 0, 0);
    periodFilter = todayStart.toISOString();
  } else if (period === '7d') {
    const sevenDaysAgo = new Date(refTime.getTime() - 7 * 24 * 60 * 60 * 1000);
    periodFilter = sevenDaysAgo.toISOString();
  }

  // Supabase RPC를 직접 쓰기 어려우므로 raw SQL을 통해 집계
  // supabase-js는 복잡한 GROUP BY + JOIN을 지원하지 않으므로 rpc 사용
  const { data, error } = await supabase.rpc('get_leaderboard', {
    p_period_filter: periodFilter,
    p_metric: metric,
    p_limit: limit,
    p_reference_time: refTime.toISOString(),
  });

  if (error) {
    // RPC가 없는 경우 대비: 수동 집계 폴백
    console.error('RPC error, falling back to manual aggregation:', error);
    return getLeaderboardFallback(period, metric, limit, refTime);
  }

  return (data as RankingRow[]) ?? [];
}

async function getLeaderboardFallback(
  period: Period,
  metric: Metric,
  limit: number,
  refTime: Date
): Promise<RankingRow[]> {
  const supabase = getSupabase();
  // records 전체 조회 후 JS에서 집계 (소규모 데이터셋용 폴백)
  let query = supabase
    .from('records')
    .select('user_id, total_tokens, estimated_cost_usd, session_count, usage_minutes, period_start, users!inner(nickname)');

  if (period === 'today') {
    const todayStart = new Date(refTime);
    todayStart.setHours(0, 0, 0, 0);
    query = query.gte('period_start', todayStart.toISOString());
  } else if (period === '7d') {
    const sevenDaysAgo = new Date(refTime.getTime() - 7 * 24 * 60 * 60 * 1000);
    query = query.gte('period_start', sevenDaysAgo.toISOString());
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Fallback query error:', error);
    return [];
  }

  // JS에서 GROUP BY nickname, SUM(metric)
  const aggregated = new Map<string, number>();
  for (const row of data as any[]) {
    const nickname = row.users?.nickname ?? 'unknown';
    const value = Number(row[metric] ?? 0);
    aggregated.set(nickname, (aggregated.get(nickname) ?? 0) + value);
  }

  return Array.from(aggregated.entries())
    .map(([nickname, value]) => ({ nickname, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const period = (searchParams.get('period') ?? 'all') as Period;
  const metric = (searchParams.get('metric') ?? 'total_tokens') as Metric;
  const limitParam = parseInt(searchParams.get('limit') ?? '50', 10);

  // 파라미터 유효성 검사
  const validPeriods: Period[] = ['today', '7d', 'all'];
  const validMetrics: Metric[] = ['total_tokens', 'estimated_cost_usd', 'session_count', 'usage_minutes'];

  if (!validPeriods.includes(period)) {
    return NextResponse.json(
      { error: 'INVALID_PARAMS', message: `period는 ${validPeriods.join(', ')} 중 하나여야 합니다.` },
      { status: 400 }
    );
  }

  if (!validMetrics.includes(metric)) {
    return NextResponse.json(
      { error: 'INVALID_PARAMS', message: `metric은 ${validMetrics.join(', ')} 중 하나여야 합니다.` },
      { status: 400 }
    );
  }

  const limit = Math.min(Math.max(isNaN(limitParam) ? 50 : limitParam, 1), 100);

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 현재 순위와 24시간 전 순위를 병렬 조회
  const [currentRankings, previousRankings] = await Promise.all([
    getLeaderboardFallback(period, metric, limit, now),
    getLeaderboardFallback(period, metric, limit, yesterday),
  ]);

  // 24시간 전 순위 맵 생성
  const previousRankMap = new Map<string, number>();
  previousRankings.forEach((row, index) => {
    previousRankMap.set(row.nickname, index + 1);
  });

  // RANK() 계산 및 순위 변동 계산
  const rankings = currentRankings.map((row, index) => {
    const currentRank = index + 1;
    const previousRank = previousRankMap.get(row.nickname);
    const rank_change = previousRank != null ? previousRank - currentRank : null;

    return {
      rank: currentRank,
      nickname: row.nickname,
      value: row.value,
      rank_change,
    };
  });

  return NextResponse.json({
    period,
    metric,
    updated_at: now.toISOString(),
    rankings,
  });
}
