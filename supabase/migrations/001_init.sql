-- AI Challenge Leaderboard 초기 스키마

-- users 테이블
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname VARCHAR(20) NOT NULL UNIQUE,
  api_key_hash VARCHAR(64) NOT NULL,  -- SHA-256 해시 저장 (64 hex chars)
  platform VARCHAR(10) NOT NULL DEFAULT 'darwin' CHECK (platform IN ('darwin', 'linux', 'win32')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- records 테이블
CREATE TABLE IF NOT EXISTS records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  input_tokens BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  cache_read_tokens BIGINT NOT NULL DEFAULT 0,
  cache_write_tokens BIGINT NOT NULL DEFAULT 0,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  usage_minutes NUMERIC(10, 1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 동일 사용자의 동일 시간대 데이터 중복 방지 (멱등성)
  CONSTRAINT records_user_period_unique UNIQUE (user_id, period_start)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_records_period_start ON records(period_start);
CREATE INDEX IF NOT EXISTS idx_records_user_period ON records(user_id, period_start);
CREATE INDEX IF NOT EXISTS idx_records_user_id ON records(user_id);
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
CREATE INDEX IF NOT EXISTS idx_users_api_key_hash ON users(api_key_hash);

-- Row Level Security (공개 읽기 허용, 쓰기는 서비스 롤만)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 정책 (닉네임, 순위 조회용)
CREATE POLICY "users_public_read" ON users
  FOR SELECT USING (true);

CREATE POLICY "records_public_read" ON records
  FOR SELECT USING (true);

-- 서비스 롤은 모든 작업 허용 (API 서버에서 사용)
CREATE POLICY "users_service_all" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "records_service_all" ON records
  FOR ALL USING (auth.role() = 'service_role');
