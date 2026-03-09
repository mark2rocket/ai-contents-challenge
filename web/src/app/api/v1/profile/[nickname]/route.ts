import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface DailyRecord {
  date: string;
  total_tokens: number;
  estimated_cost_usd: number;
  session_count: number;
  usage_minutes: number;
}

type MetricKey = 'total_tokens' | 'estimated_cost_usd' | 'session_count' | 'usage_minutes';

interface MetricSummary {
  total_tokens: number;
  estimated_cost_usd: number;
  session_count: number;
  usage_minutes: number;
}

interface ProfileResponse {
  nickname: string;
  registered_at: string;
  ranks: {
    total_tokens: { today: number | null; all_time: number | null };
    estimated_cost_usd: { today: number | null; all_time: number | null };
    session_count: { today: number | null; all_time: number | null };
    usage_minutes: { today: number | null; all_time: number | null };
  };
  summary: {
    today: MetricSummary;
    "7d_total": MetricSummary;
    "7d_avg": MetricSummary;
  };
  daily_records: DailyRecord[];
}

async function getUserRank(
  userId: string,
  metric: MetricKey,
  period: 'today' | 'all'
): Promise<number | null> {
  const supabase = getSupabase();
  let query = supabase
    .from('records')
    .select(`user_id, ${metric}`);

  if (period === 'today') {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    query = query.gte('period_start', todayStart.toISOString());
  }

  const { data, error } = await query;
  if (error || !data) return null;

  const totals = new Map<string, number>();
  for (const row of data) {
    const val = Number((row as Record<string, unknown>)[metric] ?? 0);
    totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + val);
  }

  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const rank = sorted.findIndex(([id]) => id === userId);
  return rank >= 0 ? rank + 1 : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ nickname: string }> }
) {
  const { nickname } = await params;

  const supabase = getSupabase();

  // 사용자 조회
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, nickname, platform, created_at, last_synced_at')
    .eq('nickname', nickname)
    .eq('is_active', true)
    .maybeSingle();

  if (userError) {
    console.error('DB user fetch error:', userError);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '존재하지 않는 사용자입니다.' },
      { status: 404 }
    );
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // 최근 7일 records 조회
  const { data: records, error: recordsError } = await supabase
    .from('records')
    .select(
      'period_start, total_tokens, estimated_cost_usd, session_count, usage_minutes, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens'
    )
    .eq('user_id', user.id)
    .gte('period_start', sevenDaysAgo.toISOString())
    .order('period_start', { ascending: true });

  if (recordsError) {
    console.error('DB records fetch error:', recordsError);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }

  const allRecords = records ?? [];

  // 일별 집계 (date_trunc('day', period_start) GROUP BY)
  const dailyMap = new Map<string, DailyRecord>();
  for (const rec of allRecords) {
    const date = rec.period_start.slice(0, 10); // YYYY-MM-DD
    const existing = dailyMap.get(date) ?? {
      date,
      total_tokens: 0,
      estimated_cost_usd: 0,
      session_count: 0,
      usage_minutes: 0,
    };
    dailyMap.set(date, {
      date,
      total_tokens: existing.total_tokens + Number(rec.total_tokens ?? 0),
      estimated_cost_usd:
        existing.estimated_cost_usd + Number(rec.estimated_cost_usd ?? 0),
      session_count: existing.session_count + Number(rec.session_count ?? 0),
      usage_minutes: existing.usage_minutes + Number(rec.usage_minutes ?? 0),
    });
  }

  const daily_records = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // 오늘 데이터
  const todayRecords = allRecords.filter(
    (r) => r.period_start >= todayStart.toISOString()
  );

  const todaySummary = todayRecords.reduce(
    (acc, r) => ({
      total_tokens: acc.total_tokens + Number(r.total_tokens ?? 0),
      estimated_cost_usd: acc.estimated_cost_usd + Number(r.estimated_cost_usd ?? 0),
      session_count: acc.session_count + Number(r.session_count ?? 0),
      usage_minutes: acc.usage_minutes + Number(r.usage_minutes ?? 0),
    }),
    { total_tokens: 0, estimated_cost_usd: 0, session_count: 0, usage_minutes: 0 }
  );

  // 7일 합산
  const sevenDayTotal = allRecords.reduce(
    (acc, r) => ({
      total_tokens: acc.total_tokens + Number(r.total_tokens ?? 0),
      estimated_cost_usd: acc.estimated_cost_usd + Number(r.estimated_cost_usd ?? 0),
      session_count: acc.session_count + Number(r.session_count ?? 0),
      usage_minutes: acc.usage_minutes + Number(r.usage_minutes ?? 0),
    }),
    { total_tokens: 0, estimated_cost_usd: 0, session_count: 0, usage_minutes: 0 }
  );

  // 7일 평균 (일별 기준)
  const dayCount = Math.max(daily_records.length, 1);
  const sevenDayAvg = {
    total_tokens: sevenDayTotal.total_tokens / dayCount,
    estimated_cost_usd: sevenDayTotal.estimated_cost_usd / dayCount,
    session_count: sevenDayTotal.session_count / dayCount,
    usage_minutes: sevenDayTotal.usage_minutes / dayCount,
  };

  // 4개 메트릭 × 2개 기간 = 8개 순위 병렬 계산
  const metrics: MetricKey[] = ['total_tokens', 'estimated_cost_usd', 'session_count', 'usage_minutes'];
  const rankResults = await Promise.all(
    metrics.flatMap((m) => [
      getUserRank(user.id, m, 'today'),
      getUserRank(user.id, m, 'all'),
    ])
  );

  const ranks = {
    total_tokens:       { today: rankResults[0], all_time: rankResults[1] },
    estimated_cost_usd: { today: rankResults[2], all_time: rankResults[3] },
    session_count:      { today: rankResults[4], all_time: rankResults[5] },
    usage_minutes:      { today: rankResults[6], all_time: rankResults[7] },
  };

  const response: ProfileResponse = {
    nickname: user.nickname,
    registered_at: user.created_at,
    ranks,
    summary: {
      today: todaySummary,
      "7d_total": sevenDayTotal,
      "7d_avg": sevenDayAvg,
    },
    daily_records,
  };

  return NextResponse.json(response);
}
