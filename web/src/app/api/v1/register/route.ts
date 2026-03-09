import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const NICKNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export async function POST(request: NextRequest) {
  let body: { nickname?: string; platform?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: '요청 본문이 올바른 JSON 형식이 아닙니다.' },
      { status: 400 }
    );
  }

  const { nickname, platform = 'darwin' } = body;

  // nickname 유효성 검사
  if (
    !nickname ||
    typeof nickname !== 'string' ||
    nickname.length < 3 ||
    nickname.length > 20 ||
    !NICKNAME_REGEX.test(nickname)
  ) {
    return NextResponse.json(
      {
        error: 'NICKNAME_INVALID',
        message:
          '닉네임은 3-20자의 영문자, 숫자, 언더스코어(_), 하이픈(-)만 사용할 수 있습니다.',
      },
      { status: 400 }
    );
  }

  // platform 유효성 검사
  const validPlatforms = ['darwin', 'linux', 'win32'];
  const normalizedPlatform = validPlatforms.includes(platform) ? platform : 'darwin';

  const supabase = getSupabase();

  // 닉네임 중복 확인
  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('nickname', nickname)
    .maybeSingle();

  if (fetchError) {
    console.error('DB fetch error:', fetchError);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }

  if (existing) {
    return NextResponse.json(
      { error: 'NICKNAME_TAKEN', message: '이미 사용 중인 닉네임입니다.' },
      { status: 400 }
    );
  }

  // API 키 생성 및 해시
  const api_key = randomUUID();
  const api_key_hash = createHash('sha256').update(api_key).digest('hex');

  // DB 저장
  const { error: insertError } = await supabase.from('users').insert({
    nickname,
    api_key_hash,
    platform: normalizedPlatform,
  });

  if (insertError) {
    // 동시 요청으로 인한 중복 에러 처리
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'NICKNAME_TAKEN', message: '이미 사용 중인 닉네임입니다.' },
        { status: 400 }
      );
    }
    console.error('DB insert error:', insertError);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      api_key,
      nickname,
      registered_at: new Date().toISOString(),
      leaderboard_url: 'https://ai-challenge-leaderboard.vercel.app',
    },
    { status: 201 }
  );
}
