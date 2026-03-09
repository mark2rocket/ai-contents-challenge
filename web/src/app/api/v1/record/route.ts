import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// 인메모리 rate limit 저장소 (프로덕션에서는 Redis 등으로 교체 권장)
// key: api_key_hash, value: 1시간 내 요청 타임스탬프 배열
const rateLimitStore = new Map<string, number[]>();

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1시간
const RATE_LIMIT_MAX = 2; // 1시간 내 최대 2회

function checkRateLimit(api_key_hash: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const timestamps = (rateLimitStore.get(api_key_hash) ?? []).filter(
    (ts) => ts > windowStart
  );

  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false; // rate limit 초과
  }

  timestamps.push(now);
  rateLimitStore.set(api_key_hash, timestamps);
  return true;
}

export async function POST(request: NextRequest) {
  // Authorization 헤더에서 Bearer 토큰 추출
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'AUTH_INVALID' }, { status: 401 });
  }

  const api_key = authHeader.slice(7).trim();
  if (!api_key) {
    return NextResponse.json({ error: 'AUTH_INVALID' }, { status: 401 });
  }

  // SHA-256 해시로 DB 조회
  const api_key_hash = createHash('sha256').update(api_key).digest('hex');

  const supabase = getSupabase();

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('api_key_hash', api_key_hash)
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
    return NextResponse.json({ error: 'AUTH_INVALID' }, { status: 401 });
  }

  // Rate limit 확인
  if (!checkRateLimit(api_key_hash)) {
    return NextResponse.json(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: '1시간 내 최대 2회까지 전송할 수 있습니다.',
      },
      { status: 429 }
    );
  }

  // 요청 본문 파싱
  let body: {
    period_start?: string;
    period_end?: string;
    input_tokens?: number;
    output_tokens?: number;
    cache_read_tokens?: number;
    cache_write_tokens?: number;
    estimated_cost_usd?: number;
    session_count?: number;
    usage_minutes?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: '요청 본문이 올바른 JSON 형식이 아닙니다.' },
      { status: 400 }
    );
  }

  const {
    period_start,
    period_end,
    input_tokens = 0,
    output_tokens = 0,
    cache_read_tokens = 0,
    cache_write_tokens = 0,
    estimated_cost_usd = 0,
    session_count = 0,
    usage_minutes = 0,
  } = body;

  if (!period_start || !period_end) {
    return NextResponse.json(
      { error: 'INVALID_PARAMS', message: 'period_start, period_end는 필수입니다.' },
      { status: 400 }
    );
  }

  const total_tokens = input_tokens + output_tokens + cache_read_tokens + cache_write_tokens;

  // records INSERT (멱등성: 이미 존재하면 무시)
  const { data: insertData, error: insertError } = await supabase
    .from('records')
    .insert({
      user_id: user.id,
      period_start,
      period_end,
      input_tokens,
      output_tokens,
      cache_read_tokens,
      cache_write_tokens,
      total_tokens,
      estimated_cost_usd,
      session_count,
      usage_minutes,
    })
    .select('id');

  if (insertError) {
    // unique constraint 위반 = 이미 존재하는 레코드
    if (insertError.code === '23505') {
      // last_synced_at 업데이트만 수행
      await supabase
        .from('users')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', user.id);

      return NextResponse.json({
        recorded: true,
        period_start,
        already_existed: true,
      });
    }

    console.error('DB insert error:', insertError);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }

  const already_existed = !insertData || insertData.length === 0;

  // last_synced_at 업데이트
  await supabase
    .from('users')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', user.id);

  return NextResponse.json({
    recorded: true,
    period_start,
    already_existed,
  });
}
