# AI Challenge Leaderboard PRD

**버전:** 1.0
**작성일:** 2026-03-09
**전략:** 옵션 B — 시장 경쟁력 (cc-camp-league 동등 UI/UX + 확장 메트릭)

---

## 1. 문제 정의 및 목표

### 문제
- Claude Code 사용자들이 자신의 사용량을 객관적으로 파악할 수단이 없음
- 토큰/비용 외 사용 빈도·시간 등 실질적인 "사용 강도" 지표가 없음
- 같은 커뮤니티 내 동료와 사용량을 비교할 공개된 플랫폼이 없음
- CLI 설치 후 자동 수집까지 복잡한 설정이 필요해 진입 장벽이 높음

### 목표
- 사용자가 `npx ai-challenge init` 실행 후 3분 이내에 리더보드 등록 완료
- 등록 후 1시간 내에 첫 번째 데이터가 리더보드에 반영됨
- 토큰 + 예상 비용(estimated) + 사용 빈도(세션 수) + 사용 시간(분) 4가지 메트릭 모두 리더보드에 표시
  - ⚠️ 비용은 모델별 토큰 단가 테이블 기반 추정치(`estimated_cost_usd`)로 표시, Max 플랜 사용자에게는 참고치임을 UI에 명시

---

## 2. 타겟 유저 및 페르소나

### 페르소나 1: 개발자 김준호 (28세)
- **배경:** 프리랜서 개발자, Claude Code 헤비 유저, Mac/Warp 사용
- **니즈:** 내가 다른 Claude Code 사용자보다 얼마나 많이 쓰는지 비교하고 싶음
- **행동 패턴:** 하루 평균 8-12시간 코딩, 터미널 상주, 새로운 CLI 도구 적극 도입
- **Pain Points:** Claude Code 비용이 얼마나 나오는지 월별로 추적하기 어려움

### 페르소나 2: 부트캠프 참가자 이수연 (25세)
- **배경:** 비전공자 개발 입문, AI 코딩 캠프 수강 중, Claude Code 입문 1개월
- **니즈:** 동료들과 학습 강도를 비교해 동기 부여를 받고 싶음
- **행동 패턴:** 하루 3-5시간 학습, 주로 오후에 집중적으로 사용
- **Pain Points:** 내가 충분히 연습하고 있는지 객관적 기준이 없음

---

## 3. User Stories

### US-001: CLI 등록
**As a** Claude Code 사용자
**I want to** 터미널 커맨드 하나로 리더보드에 등록하고
**So that** 별도 회원가입 없이 즉시 참여할 수 있다

**Acceptance Criteria:**
- [ ] `npx ai-challenge init` 실행 시 닉네임 입력 프롬프트 표시
- [ ] 닉네임 입력 후 서버에서 UUID 기반 API 키 발급 (POST /api/v1/register)
- [ ] API 키가 `~/.ai-challenge/config.json`에 자동 저장
- [ ] 성공 메시지와 함께 웹 리더보드 URL 출력
- [ ] cron 등록 여부 확인 후 자동 설정 (crontab -l 확인 후 추가)

### US-002: 자동 데이터 수집 및 전송
**As a** 등록된 사용자
**I want to** Claude Code 사용 데이터가 자동으로 수집되어 전송되고
**So that** 별도 조작 없이 리더보드가 실시간으로 업데이트된다

**Acceptance Criteria:**
- [ ] 매 정각에 `~/.claude/` 로그를 파싱해 지난 1시간 사용량 집계
- [ ] 토큰 수, 비용(USD), 세션 수(사용 빈도), 총 사용 시간(분) 4가지 집계
- [ ] POST /api/v1/record에 API 키 포함해 전송
- [ ] 전송 성공 시 `~/.ai-challenge/last_sync.json`에 타임스탬프 기록
- [ ] 전송 실패 시 로컬에 큐잉하고 다음 전송 시 재시도 (최대 3회)

### US-003: 리더보드 조회
**As a** 방문자 (등록 여부 무관)
**I want to** 웹에서 전체 순위를 조회하고
**So that** 나와 다른 사용자의 사용량을 비교할 수 있다

**Acceptance Criteria:**
- [ ] 기간 필터: 오늘 / 7일 / 전체 탭 전환 시 즉시 반영
- [ ] 메트릭 필터: 토큰 / 비용 / 세션 수 / 사용 시간 중 선택
- [ ] 각 행에 순위, 닉네임, 선택 메트릭 값, 전일 대비 순위 변동(▲▼) 표시
- [ ] 상위 3위는 금/은/동 배지 강조 표시
- [ ] 페이지 로드 후 3초 이내 데이터 표시 (서버 사이드 렌더링)

### US-004: 개인 프로필 조회
**As a** 등록된 사용자
**I want to** 내 닉네임으로 개인 페이지에 접근해
**So that** 일별 사용량 추이와 메트릭별 상세 기록을 볼 수 있다

**Acceptance Criteria:**
- [ ] `/profile/[nickname]` 경로로 개인 페이지 접근 가능
- [ ] 최근 7일 일별 토큰/비용/세션수/사용시간 막대 차트 표시
- [ ] 각 메트릭의 오늘 값, 7일 합계, 7일 평균 표시
- [ ] 전체 순위, 오늘 순위 (메트릭별로 각각) 표시
- [ ] 공유 URL 복사 버튼 제공

---

## 4. 상세 유저 플로우

### 플로우 1: 최초 등록 (CLI)

**단계 1: CLI 설치 및 init 실행**
- **사용자 액션:** 터미널에서 `npx ai-challenge init` 실행
- **시스템 반응:**
  - npx가 `ai-challenge` 패키지 다운로드
  - "닉네임을 입력하세요 (영문/숫자, 3-20자):" 프롬프트 출력
- **다음 단계:** → 단계 2

**단계 2: 닉네임 등록**
- **사용자 액션:** 닉네임 입력 후 Enter
- **시스템 반응:**
  - POST /api/v1/register → `{ nickname, platform: 'darwin' | 'linux' | 'win32' }`
  - 서버: 닉네임 중복 검사 → UUID 생성 → DB 저장 → API 키 반환
  - `~/.ai-challenge/config.json` 생성: `{ "nickname": "...", "apiKey": "uuid-...", "registeredAt": "ISO8601" }`
  - 성공 메시지: "✅ 등록 완료! 리더보드: https://ai-challenge-leaderboard.vercel.app"
- **다음 단계:** → 단계 3

**단계 3: cron 자동 설정**
- **시스템 반응:**
  - `process.platform` 확인:
    - **macOS/Linux:** `crontab -l` 실행 후 `0 * * * * /usr/local/bin/npx ai-challenge sync` 라인 추가 (절대 경로 사용)
    - **Windows:** cron 미지원. "⚠️ Windows는 자동 전송이 지원되지 않습니다. `npx ai-challenge sync`를 수동으로 실행하세요." 안내 출력
  - 성공 시 "✅ 매 정각 자동 전송이 설정되었습니다." 출력
  - 즉시 첫 sync 실행 (초기 데이터 전송)
  - 리더보드 URL에 닉네임 파라미터 포함해 출력: `https://ai-challenge-leaderboard.vercel.app?nickname={nickname}`

### 플로우 2: 자동 데이터 수집 (cron, 1시간 주기)

> ⚠️ **실제 Claude Code 로그 구조 기반** (검증 완료):
> - 로그 경로: `~/.claude/projects/{encoded-path}/{session-uuid}.jsonl`
> - `~/.claude/logs/` 디렉토리는 존재하지 않음
> - `costUSD` 필드 없음 → 모델별 단가 테이블로 자체 계산
> - `startTime`/`endTime` 필드 없음 → 메시지 `timestamp`로 산출

**단계 1: 로그 파싱**
- **시스템 반응:**
  1. `~/.claude/projects/` 하위 모든 `*.jsonl` 파일을 glob으로 탐색 (`subagents/` 포함)
  2. 각 파일을 readline 스트리밍으로 파싱, `type === "assistant"` 레코드만 필터
  3. top-level `timestamp` 필드가 `period_start` ≤ t < `period_end` 범위인 레코드 선택
  4. `message.usage`에서 토큰 집계:
     - `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`
     - ※ `message.usage.cache_creation`이 하위 객체인 경우 `ephemeral_5m_input_tokens` + `ephemeral_1h_input_tokens` 합산
  5. `message.model`로 모델명 추출 → 단가 JSON 테이블에서 `estimated_cost_usd` 계산
     - 미인식 모델(`<synthetic>` 등)은 비용 0으로 처리하고 경고 로그
  6. 세션 수 = 해당 기간 내 unique `sessionId` (또는 파일명 UUID) 수
  7. 사용 시간(분) = 동일 `sessionId` 내 첫 `timestamp` ~ 마지막 `timestamp` 차이 합산
     - 메시지 간격이 30분 초과 시 별도 세션으로 분리하여 계산
  8. 집계 결과가 모두 0이면 전송 스킵 (빈 데이터 방지)

**단계 2: 데이터 전송**
- **시스템 반응:**
  - POST /api/v1/record
  - 전송 성공 → `last_sync.json` 업데이트
  - 전송 실패 → `queue.json`에 적재, 다음 cron 시 재전송

### 플로우 3: 리더보드 웹 조회

**화면 1: 메인 리더보드**
- **UI 구성:**
  - 상단: 로고 + 슬로건 텍스트
  - 기간 탭: "오늘" | "7일" | "전체" (선택된 탭 하이라이트)
  - 메트릭 탭: "토큰" | "예상비용 ⚠️" | "세션수" | "사용시간"
    - "예상비용" 탭 선택 시 툴팁: "Max 플랜 사용자에게는 실제 비용과 다를 수 있습니다"
  - 리더보드 테이블: 순위 | 닉네임 | 값 | 순위변동
  - 상위 3위: 금(#FFD700)/은(#C0C0C0)/동(#CD7F32) 배지
- **사용자 액션:** 기간/메트릭 탭 클릭
- **시스템 반응:** URL 쿼리 파라미터 업데이트, 테이블 즉시 재렌더링
- **다음 단계:** → 닉네임 클릭 시 개인 프로필 페이지

**화면 2: 개인 프로필**
- **UI 구성:**
  - 닉네임, 등록일, 전체 순위
  - 7일 사용량 막대 차트 (일별 토큰/비용/세션수/사용시간)
  - 메트릭 요약 카드 4개: 오늘 / 7일 합계 / 7일 평균
  - 공유 URL 복사 버튼
- **사용자 액션:** 차트 메트릭 토글, 공유 버튼 클릭
- **시스템 반응:** 차트 데이터 전환, 클립보드에 URL 복사

---

## 5. Functional Requirements

### 5.1 데이터 구조

```typescript
// Users 테이블
interface User {
  id: string;               // UUID (PK)
  nickname: string;         // 유니크, 3-20자, /^[a-zA-Z0-9_-]+$/
  api_key: string;          // UUID v4, 인증용
  platform: 'darwin' | 'linux' | 'win32';
  created_at: string;       // ISO8601
  last_synced_at: string;   // ISO8601, 마지막 성공 전송 시각
  is_active: boolean;       // 7일 이상 미전송 시 false
}

// Records 테이블
interface Record {
  id: string;                    // UUID (PK)
  user_id: string;               // FK → Users.id
  period_start: string;          // ISO8601, 집계 시작 시각 (정각)
  period_end: string;            // ISO8601, 집계 종료 시각 (다음 정각)
  input_tokens: number;          // message.usage.input_tokens 합산
  output_tokens: number;         // message.usage.output_tokens 합산
  cache_read_tokens: number;     // message.usage.cache_read_input_tokens 합산
  cache_write_tokens: number;    // message.usage.cache_creation_input_tokens 합산 (ephemeral 포함)
  total_tokens: number;          // input + output + cache_read + cache_write
  estimated_cost_usd: number;    // 모델별 단가 테이블 기반 추정치, 소수점 6자리 (costUSD 필드 미존재로 자체 계산)
  session_count: number;         // 해당 기간 내 unique sessionId 수
  usage_minutes: number;         // sessionId별 (마지막 timestamp - 첫 timestamp) 합산, 30분 초과 간격은 별도 세션 처리
  created_at: string;            // ISO8601
}

// CLI config (~/.ai-challenge/config.json)
interface CLIConfig {
  nickname: string;
  api_key: string;
  registered_at: string;    // ISO8601
  server_url: string;       // default: "https://ai-challenge-leaderboard.vercel.app"
}

// CLI queue (~/.ai-challenge/queue.json)
interface QueueItem {
  payload: RecordPayload;
  attempts: number;         // 최대 3
  queued_at: string;        // ISO8601
}
```

### 5.2 API 엔드포인트

**POST /api/v1/register**
- **요청:**
  ```json
  {
    "nickname": "string (3-20자, /^[a-zA-Z0-9_-]+$/)",
    "platform": "darwin | linux | win32"
  }
  ```
- **응답 (성공 201):**
  ```json
  {
    "api_key": "uuid-v4",
    "nickname": "string",
    "leaderboard_url": "https://ai-challenge-leaderboard.vercel.app"
  }
  ```
- **응답 (실패):**
  ```json
  { "error": "NICKNAME_TAKEN", "message": "이미 사용 중인 닉네임입니다." }
  { "error": "NICKNAME_INVALID", "message": "닉네임은 영문, 숫자, _, -만 사용 가능합니다 (3-20자)." }
  ```

**POST /api/v1/record**
- **헤더:** `Authorization: Bearer {api_key}`
- **요청:**
  ```json
  {
    "period_start": "2026-03-09T10:00:00Z",
    "period_end": "2026-03-09T11:00:00Z",
    "input_tokens": 12500,
    "output_tokens": 8300,
    "cache_read_tokens": 450,
    "cache_write_tokens": 120,
    "estimated_cost_usd": 0.043210,
    "session_count": 3,
    "usage_minutes": 42.5
  }
  ```
- **응답 (성공 200):**
  ```json
  { "recorded": true, "period_start": "2026-03-09T10:00:00Z", "already_existed": false }
  ```
  - `already_existed: true` — 동일 `(user_id, period_start)` 데이터가 이미 존재하는 경우 (멱등 처리, 에러 아님)
  - 서버는 `ON CONFLICT (user_id, period_start) DO NOTHING` 처리 후 항상 200 반환
- **응답 (실패):**
  ```json
  { "error": "AUTH_INVALID", "message": "유효하지 않은 API 키입니다." }
  { "error": "RATE_LIMIT", "message": "전송이 너무 빠릅니다. 다음 정각에 자동 전송됩니다." }
  ```

**GET /api/v1/leaderboard**
- **쿼리 파라미터:**
  - `period`: `today` | `7d` | `all` (default: `today`)
  - `metric`: `total_tokens` | `estimated_cost_usd` | `session_count` | `usage_minutes` (default: `total_tokens`)
  - `limit`: 1-100 (default: 50)
- **응답 (성공 200):**
  ```json
  {
    "period": "today",
    "metric": "total_tokens",
    "updated_at": "2026-03-09T11:00:00Z",
    "rankings": [
      {
        "rank": 1,
        "nickname": "junodev",
        "value": 284500,
        "rank_change": 0
      }
    ]
  }
  ```
  - `is_me` 필드 제거 — 서버는 요청자 신원을 알 수 없음
  - 클라이언트가 `localStorage.getItem('ai-challenge-nickname')` 값과 비교하여 자체 하이라이트
  - `?nickname=xxx` 쿼리 파라미터로 접근 시 웹 페이지가 자동으로 localStorage에 저장

**GET /api/v1/profile/[nickname]**
- **응답 (성공 200):**
  ```json
  {
    "nickname": "junodev",
    "registered_at": "2026-03-01T00:00:00Z",
    "ranks": {
      "total_tokens": { "today": 1, "all_time": 3 },
      "estimated_cost_usd": { "today": 1, "all_time": 2 },
      "session_count": { "today": 4, "all_time": 5 },
      "usage_minutes": { "today": 2, "all_time": 3 }
    },
    "daily_records": [
      {
        "date": "2026-03-09",
        "total_tokens": 284500,
        "estimated_cost_usd": 1.2341,
        "session_count": 12,
        "usage_minutes": 320.5
      }
    ],
    "summary": {
      "today": { "total_tokens": 284500, "estimated_cost_usd": 1.2341, "session_count": 12, "usage_minutes": 320.5 },
      "7d_total": { "total_tokens": 1240000, "estimated_cost_usd": 5.4210, "session_count": 67, "usage_minutes": 1842.0 },
      "7d_avg": { "total_tokens": 177142, "estimated_cost_usd": 0.7744, "session_count": 9, "usage_minutes": 263.1 }
    }
  }
  ```

### 5.3 비즈니스 로직

**로직 1: 로그 파싱 (CLI)**
> ⚠️ `~/.claude/logs/` 디렉토리는 존재하지 않음. 실제 경로는 아래와 같이 재설계됨.

1. `~/.claude/projects/` 하위 모든 `*.jsonl` 파일을 재귀 glob으로 탐색
   - `subagents/` 하위 JSONL도 포함 (서브에이전트 토큰도 집계)
   - 경로 인코딩 패턴: `/Users/name/project` → `-Users-name-project`
2. 각 파일을 readline 스트리밍으로 파싱 (메모리 효율)
3. `type === "assistant"` 레코드만 선택
4. top-level `timestamp` (ISO8601)가 `period_start` ≤ t < `period_end`인 레코드 필터
5. `message.usage`에서 토큰 집계:
   - `input_tokens` → `input_tokens`
   - `output_tokens` → `output_tokens`
   - `cache_read_input_tokens` → `cache_read_tokens`
   - `cache_creation_input_tokens` → `cache_write_tokens`
     ※ `message.usage.cache_creation`이 객체인 경우: `ephemeral_5m_input_tokens + ephemeral_1h_input_tokens`
6. `message.model`로 모델명 추출 → `pricing.json` 단가 테이블에서 `estimated_cost_usd` 계산
   - 미인식 모델은 비용 0 처리 + stderr 경고
7. `session_count` = 해당 기간 레코드의 unique `sessionId` 수
8. `usage_minutes` 계산:
   - 동일 `sessionId`끼리 `timestamp` 오름차순 정렬
   - 연속 메시지 간격이 30분 이하이면 동일 세션 지속, 30분 초과이면 세션 분리
   - 각 세션의 (마지막 timestamp - 첫 timestamp)를 분으로 환산 후 합산
9. 집계 결과 `total_tokens === 0`이면 전송 스킵

**로직 2: 리더보드 집계 (서버)**
1. `period=today`: `period_start >= CURRENT_DATE 00:00:00 UTC`인 Records 조회
2. `period=7d`: `period_start >= CURRENT_DATE - 7 days` Records 조회
3. `period=all`: 전체 Records 조회
4. user_id로 GROUP BY → 선택 metric SUM → DESC 정렬 → RANK() OVER
5. 결과를 5분 TTL로 Vercel KV 캐싱

**로직 3: 순위 변동 계산**
1. 현재 순위 (`current_rank`) 산출
2. 24시간 전 동일 조건 순위 (`prev_rank`) 산출
3. `rank_change = prev_rank - current_rank` (양수: 상승, 음수: 하락, 0: 변동 없음)

### 5.4 예외 처리

| 에러 코드 | 발생 조건 | 사용자 메시지 | 처리 방법 |
|----------|---------|------------|---------|
| AUTH_INVALID | API 키 불일치 | "유효하지 않은 API 키입니다. ai-challenge init을 다시 실행하세요." | CLI 종료 코드 1 반환 |
| NICKNAME_TAKEN | 닉네임 중복 | "이미 사용 중인 닉네임입니다. 다른 닉네임을 선택하세요." | 재입력 프롬프트 |
| DUPLICATE_PERIOD | 동일 `(user_id, period_start)` 재전송 | (무시) | 서버 `ON CONFLICT DO NOTHING` → 200 OK + `already_existed: true`. 에러 아님, 큐에서 제거 |
| LOG_NOT_FOUND | `~/.claude/projects/` 하위 JSONL 없음 | "Claude Code 로그를 찾을 수 없습니다. Claude Code를 한 번 이상 실행한 후 다시 시도하세요." | CLI 종료 코드 1 |
| UNKNOWN_MODEL | 단가 테이블에 없는 모델명 | (stderr 경고만, 종료 없음) | 해당 레코드 비용 0 처리 후 계속 집계 |
| NETWORK_ERROR | 서버 연결 실패 | "서버 연결 실패. 데이터를 큐에 저장합니다." | queue.json에 적재, 다음 sync 시 재전송 (최대 3회) |
| RATE_LIMIT | 동일 API 키로 1시간 내 2회 이상 전송 | "전송이 너무 빠릅니다. 다음 정각에 자동 전송됩니다." | 429 반환, CLI는 큐에 저장하지 않고 무시 |

---

## 6. UI/UX Guidelines

### 디자인 원칙 (cc-camp-league 동등 수준)
- **다크 모드 기반:** 배경 `#0a0a0a`, 카드 `#111111`, 보더 `#222222`
- **Space Grotesk 폰트:** 숫자 데이터에 `font-variant-numeric: tabular-nums` 적용
- **즉시 반응:** 탭 전환 시 loading skeleton 300ms → 데이터 교체
- **색상 체계:** 상승 `#22c55e` (green-500), 하락 `#ef4444` (red-500), 중립 `#6b7280` (gray-500)

### 컴포넌트 명세

**리더보드 테이블 행**
```
배경: bg-[#111111] hover:bg-[#1a1a1a]
보더: border-b border-[#222222]
패딩: px-4 py-3
순위 컬럼: w-12 text-right font-mono text-gray-400
닉네임 컬럼: flex-1 font-medium text-white cursor-pointer hover:underline
값 컬럼: w-32 text-right font-mono tabular-nums text-white
변동 컬럼: w-16 text-right text-sm (▲n: text-green-500, ▼n: text-red-500, -: text-gray-500)
```

**기간/메트릭 탭**
```
비활성: bg-transparent text-gray-400 hover:text-white border border-[#333333]
활성: bg-white text-black font-semibold
크기: px-4 py-1.5 rounded-full text-sm
```

**상위 3위 배지**
```
1위: text-[#FFD700] + 왼쪽에 👑 아이콘
2위: text-[#C0C0C0] + 왼쪽에 🥈 아이콘
3위: text-[#CD7F32] + 왼쪽에 🥉 아이콘
```

**메트릭 요약 카드 (프로필 페이지)**
```
배경: bg-[#111111] rounded-xl border border-[#222222]
패딩: p-4
제목: text-xs text-gray-500 uppercase tracking-wider
값: text-2xl font-bold font-mono tabular-nums text-white
서브: text-xs text-gray-400 mt-1
```

### 반응형 규칙
- **Mobile (< 640px):** 리더보드 테이블 → 순위/닉네임/값만 표시 (변동 컬럼 숨김), 차트 높이 200px
- **Tablet (640px - 1024px):** 전체 컬럼 표시, 차트 높이 250px
- **Desktop (> 1024px):** 최대 너비 900px 중앙 정렬, 차트 높이 300px

### 값 포맷 규칙
- `total_tokens`: `284,500 tokens` (천 단위 콤마)
- `estimated_cost_usd`: `~$1.2341` (소수점 4자리, `~` 접두사로 추정치 명시)
- `session_count`: `12 sessions`
- `usage_minutes`: `5h 20m` (60분 이상이면 시간 단위 변환)

---

## 7. Tech Stack Recommendation

### Frontend + Backend (단일 레포)
- **Framework:** Next.js 15 (App Router) — SSR/ISR로 리더보드 초기 로드 최적화
- **Styling:** Tailwind CSS 4.0 — 다크 모드 기반 커스텀 디자인
- **차트:** Recharts — 경량, SSR 호환, 커스텀 스타일 용이
- **상태 관리:** TanStack Query — 서버 상태 캐싱, 5분 stale time

### 데이터베이스
- **Primary:** Supabase (PostgreSQL) — `Records` 테이블 파티셔닝 (`period_start` 기준 월별)
- **Cache:** Vercel KV (Redis) — 리더보드 집계 결과 5분 TTL 캐싱

### CLI 패키지
- **Runtime:** Node.js 18+ (npx 실행 호환)
- **패키지명:** `ai-challenge` (npm 배포)
- **주요 커맨드:**
  - `npx ai-challenge init` — 닉네임 등록 + cron 설정 (macOS/Linux) / 수동 안내 (Windows)
  - `npx ai-challenge sync` — 수동/cron 데이터 전송
  - `npx ai-challenge status` — 마지막 전송 시각, 다음 전송까지 남은 시간 출력
- **로그 파싱:** fs/promises + readline 스트리밍 (대용량 JSONL 메모리 효율 처리)
- **단가 테이블:** 패키지 내 `pricing.json` 분리 관리 (모델별 input/output/cache 단가)
- **HTTP 클라이언트:** Node.js 내장 fetch
- **플랫폼 지원:** macOS/Linux (자동 cron), Windows (수동 sync만)

### DevOps
- **Hosting:** Vercel (Next.js 네이티브 최적화)
- **패키지 레지스트리:** npm public
- **CI/CD:** GitHub Actions — `npm publish` 자동화

### 라이브러리 선정 이유
- Supabase: PostgreSQL + 내장 Row Level Security로 API 키 기반 인증 간소화
- Vercel KV: 동일 플랫폼 내 초저지연 캐싱, 별도 Redis 인프라 불필요
- Recharts: D3 대비 React 친화적, 커스텀 Tooltip/Legend 확장성 높음

---

## 8. 구현 우선순위

**Phase 1 (Week 1): 핵심 데이터 파이프라인**
- [ ] Supabase DB 스키마 생성 (Users, Records 테이블)
  - 인덱스: `(user_id, period_start)` 복합 유니크, `(period_start)` 기간 필터용
  - Users 테이블: `api_key`는 서버에 SHA-256 해시로 저장 (평문 DB 노출 방지)
- [ ] POST /api/v1/register — 닉네임 등록, API 키 발급 (해시 저장)
- [ ] POST /api/v1/record — `ON CONFLICT (user_id, period_start) DO NOTHING` + `already_existed` 플래그
- [ ] CLI `ai-challenge init` 커맨드 (닉네임 등록 + config 저장 + cron 설정, Windows 분기 처리)
- [ ] CLI `ai-challenge sync` 커맨드:
  - `~/.claude/projects/` 재귀 glob + readline 스트리밍 파싱
  - `pricing.json` 단가 테이블 기반 `estimated_cost_usd` 계산
  - sessionId 기반 `session_count`, 30분 간격 분리 기반 `usage_minutes` 산출
  - API 전송 + 큐 처리 (최대 3회 재시도)

**Phase 2 (Week 2): 웹 리더보드 UI**
- [ ] GET /api/v1/leaderboard API 구현 (기간/메트릭 필터 + Vercel KV 캐싱)
- [ ] 메인 리더보드 페이지 (`/`) — 다크 모드, 탭 필터, 순위 테이블
- [ ] 개인 프로필 페이지 (`/profile/[nickname]`) — 요약 카드 + 7일 차트

**Phase 3 (Week 3): 완성도 향상**
- [ ] 순위 변동 계산 로직 추가
- [ ] 공유 URL 복사 기능
- [ ] CLI `ai-challenge status` 커맨드 (마지막 전송 시각, 다음 전송까지 남은 시간 출력)
- [ ] npm 패키지 배포 + README 작성

---

## 9. 성공 지표

- **등록 사용자 수:** 출시 2주 내 50명
- **데이터 전송 성공률:** 95% 이상 (실패 → 큐 처리 포함)
- **리더보드 페이지 DAU:** 등록 사용자의 60% 이상
- **CLI 설치 ~ 첫 데이터 전송 시간:** 평균 3분 이내

---

**이 PRD는 AI 코딩 에이전트에게 전달하여 즉시 구현을 시작할 수 있습니다.**
