# PRD Validation & Implementation Plan: AI Challenge Leaderboard

**작성일:** 2026-03-09
**상태:** Draft - 사용자 확인 대기

---

## 1. PRD 완성도 평가 (10점 만점, 섹션별)

| 섹션 | 점수 | 평가 |
|------|------|------|
| 1. 문제 정의 및 목표 | 8/10 | 명확한 문제 정의, 정량적 목표(3분 내 등록) 제시. 단, 비기능적 요구사항(동시 사용자 수, 데이터 보존 기간) 부재 |
| 2. 타겟 유저 | 7/10 | 페르소나 2개 제시. 단, 헤비 유저 vs 입문자 외 팀/조직 단위 사용 시나리오 미고려 |
| 3. User Stories | 9/10 | AC가 구체적이고 검증 가능. 우수한 수준 |
| 4. 유저 플로우 | 8/10 | 단계별 상세 기술. 에러 플로우(cron 설정 실패, 권한 부족)가 불완전 |
| 5. Functional Requirements | 6/10 | **CRITICAL: 로그 파싱 경로와 데이터 구조가 실제와 불일치** (아래 상세) |
| 6. UI/UX Guidelines | 9/10 | 컴포넌트 명세, 색상, 반응형 규칙 모두 구체적. 실무 착수 가능 수준 |
| 7. Tech Stack | 8/10 | 합리적 선택. Vercel KV 무료 티어 제한(256 connections, 30MB) 고려 필요 |
| 8. 구현 우선순위 | 7/10 | Phase 분리 적절. 각 Phase의 완료 기준(Definition of Done)이 없음 |
| 9. 성공 지표 | 6/10 | 정량 목표 있으나, 측정 방법 미기술. "DAU 60%"의 측정 도구 없음 |
| **종합** | **7.5/10** | 로그 파싱 구조 오류만 수정하면 구현 착수 가능한 수준 |

---

## 2. 누락된 요구사항

### Critical (구현 불가 또는 주요 기능 장애)

**C-1: 로그 파싱 경로 및 데이터 구조 불일치**
- PRD: `~/.claude/logs/` 디렉토리에서 JSONL 파싱, `costUSD` 필드 직접 추출
- 실제: `~/.claude/logs/` 디렉토리는 존재하지 않음
- 실제 데이터 위치:
  - 세션 transcript: `~/.claude/transcripts/{session_id}.jsonl`
  - 프로젝트별 세션: `~/.claude/projects/{path-encoded}/{session_id}/` 하위 JSONL
  - 통계 캐시: `~/.claude/stats-cache.json` (messageCount, sessionCount, toolCallCount만 포함)
- 실제 JSONL 구조에서 추출 가능한 데이터:
  - `usage.input_tokens`, `usage.output_tokens` (assistant 메시지에만 존재)
  - `usage.cache_creation_input_tokens`, `usage.cache_read_input_tokens`
  - `costUSD` 필드 없음 -- 토큰 단가 기반 자체 계산 필요
  - `session_count`는 `stats-cache.json`에서 획득 가능하나, 실시간이 아님 (lastComputedDate 기준)
- 영향: CLI sync 커맨드 전체 재설계 필요

**C-2: 비용(cost_usd) 계산 로직 부재**
- PRD: `costUSD` 필드를 로그에서 직접 추출한다고 가정
- 실제: Claude Code 로그에 비용 정보 없음
- 해결 필요: 모델별 토큰 단가 테이블 관리 + 자체 계산 로직 구현 필요
- 단, 모델명은 JSONL `message.model` 필드에 존재 (예: `claude-sonnet-4-5-20250929`)

**C-3: 사용 시간(usage_minutes) 산출 로직 재검토**
- PRD: 각 세션의 `startTime` ~ `endTime` 차이로 산출
- 실제: JSONL에는 개별 메시지의 `timestamp`만 있고, 명시적 `startTime`/`endTime` 없음
- 해결: 세션 내 첫/마지막 메시지 timestamp 차이로 근사치 산출 가능 (유휴 시간 포함 문제)

### Major (기능은 동작하나 품질/안정성 저하)

**M-1: Windows crontab 미지원**
- PRD: `platform: 'win32'` 지원을 명시하지만, cron 설정 로직은 Unix crontab만 기술
- Windows에서는 Task Scheduler 또는 대안 필요

**M-2: 데이터 보존 및 정리 정책 없음**
- Records 테이블이 무한 증가
- 월별 파티셔닝은 언급했으나, 오래된 데이터 아카이빙/삭제 정책 미정의

**M-3: API 키 보안**
- API 키가 UUID v4 평문 저장/전송
- HTTPS 전송이지만, 키 rotation/revoke 메커니즘 없음
- 탈취 시 타인 데이터 오염 가능

**M-4: DUPLICATE_PERIOD 처리 모순**
- 예외 처리 표: "서버에서 200 OK 반환, 중복 무시"
- API 응답 명세: 409 에러 반환 `{ "error": "DUPLICATE_PERIOD" }`
- 둘 중 하나로 통일 필요 (권장: 200 OK + upsert 또는 무시)

**M-5: 리더보드 `is_me` 필드 구현 방법 미정의**
- API 응답에 `is_me: boolean`이 있지만, 웹 페이지에서 현재 사용자를 어떻게 식별하는지 미기술
- 웹은 인증 없이 조회 가능하므로, 쿼리 파라미터 또는 로컬스토리지 기반 필요

### Minor (개선사항)

**m-1: CLI 에러 메시지 다국어**
- 에러 메시지가 한국어로 하드코딩 -- npm 글로벌 배포 시 영문 필요

**m-2: 닉네임 변경/삭제 기능 없음**
- 등록 후 닉네임 수정 또는 계정 삭제 API/CLI 미정의

**m-3: Pagination 미정의**
- 리더보드 API에 `limit`만 있고 `offset`/`cursor` 없음

**m-4: Rate Limiting 상세 부재**
- "1시간 내 2회 이상 전송" 외 API 전체 rate limit 미정의

---

## 3. 기술적 리스크

### High

| 리스크 | 설명 | 완화 방안 |
|--------|------|----------|
| **로그 파싱 구조 전면 재설계** | PRD의 로그 경로/구조가 실제와 완전히 다름. CLI 핵심 기능 전체 재작성 필요 | 실제 `~/.claude/transcripts/` 및 프로젝트별 JSONL 구조 기반으로 파서 재설계 |
| **Claude Code 로그 포맷 변경** | Claude Code 업데이트 시 JSONL 구조 변경 가능. 공식 API가 아닌 내부 파일 의존 | 파서에 버전 감지 로직 추가, 스키마 변경 시 graceful fallback |
| **비용 계산 정확도** | 모델별 토큰 단가가 변경될 수 있음. cache_creation vs cache_read 단가 차이 | 단가 테이블을 설정 파일로 분리, 주기적 업데이트 메커니즘 |

### Medium

| 리스크 | 설명 | 완화 방안 |
|--------|------|----------|
| **Vercel KV 무료 티어 제한** | 30MB 저장소, 일 30,000 요청. 사용자 50명 이상 시 초과 가능 | TTL 적극 활용, 필요시 Supabase 캐싱으로 대체 |
| **npx 실행 시 cron 호환성** | `npx ai-challenge sync`가 cron 환경에서 PATH/node 버전 문제 발생 가능 | cron에는 절대 경로(`/usr/local/bin/npx`) 사용, init 시 which npx 경로 저장 |
| **대용량 로그 파싱 성능** | 헤비 유저의 transcript 파일이 수십 MB 가능 | 스트리밍 파싱(readline), period 기반 필터링으로 불필요 파일 스킵 |

### Low

| 리스크 | 설명 | 완화 방안 |
|--------|------|----------|
| npm 패키지명 `ai-challenge` 충돌 | 이미 등록된 패키지일 수 있음 | npm 검색으로 사전 확인, 대안명 준비 |
| Supabase 무료 티어 제한 | 500MB DB, 50,000 rows/month | 초기 단계에서는 충분, 성장 시 유료 전환 |

---

## 4. RALPLAN-DR 요약

### Principles (핵심 원칙)

1. **실제 데이터 기반 설계 (Ground Truth First):** PRD 가정이 아닌 실제 Claude Code 파일 구조에 맞춰 파서 설계
2. **최소 외부 의존성 (Lean Dependencies):** CLI는 Node.js 내장 모듈 우선, 외부 패키지 최소화
3. **점진적 가치 전달 (Incremental Value):** Phase별로 동작하는 최소 기능 우선 배포
4. **데이터 정확성 우선 (Accuracy over Speed):** 토큰/비용 계산이 부정확하면 리더보드 신뢰성 상실
5. **Graceful Degradation:** 로그 포맷 변경, 네트워크 실패 등에서도 데이터 손실 없이 동작

### Decision Drivers (Top 3)

1. **Claude Code 로그 구조 호환성:** 실제 `~/.claude/` 파일 구조에 정확히 맞춰야 핵심 기능이 동작함
2. **사용자 온보딩 속도:** "3분 내 등록" 목표 달성을 위해 CLI UX가 최우선
3. **데이터 파이프라인 안정성:** cron 기반 자동 수집이 실패 없이 동작해야 리더보드에 지속적 데이터 공급

### Viable Options (구현 접근 방식)

#### Option A: Transcript JSONL 직접 파싱

- **설명:** `~/.claude/transcripts/*.jsonl` + `~/.claude/projects/*/` 하위 JSONL을 직접 파싱하여 토큰 사용량 추출
- **Pros:**
  - 가장 상세한 데이터 획득 가능 (모델별, 메시지별 토큰)
  - usage_minutes를 메시지 timestamp로 정밀 산출 가능
  - 세션별 분석, 모델 분포 등 확장 메트릭 가능성
- **Cons:**
  - 파일 구조가 비공식이므로 Claude Code 업데이트 시 깨질 수 있음
  - 대용량 파일 파싱 성능 이슈 (헤비 유저 transcript = 수십 MB)
  - 비용 계산을 위해 모델별 단가 테이블 자체 관리 필요
  - 프로젝트 경로 인코딩 규칙 파악 필요 (`-Users-kimsaeam-cc-playground-BFM` 형태)

#### Option B: stats-cache.json + 경량 transcript 샘플링

- **설명:** `stats-cache.json`의 일별 집계(messageCount, sessionCount, toolCallCount)를 기본 데이터로 활용하고, transcript에서는 최근 1시간 분만 샘플링
- **Pros:**
  - 파싱 부하 최소화 (stats-cache는 이미 집계된 데이터)
  - Claude Code 내부 변경에 대한 의존도 낮음
  - 구현 복잡도 낮음
- **Cons:**
  - stats-cache.json은 `lastComputedDate` 기준으로만 업데이트됨 (실시간 아님)
  - 토큰 수 데이터가 stats-cache에 없음 (messageCount만 있음)
  - PRD 요구사항인 토큰/비용 메트릭 제공 불가 -- 리더보드 핵심 가치 훼손
  - **평가: 핵심 메트릭 부재로 사실상 불가**

#### 권장: Option A (Transcript JSONL 직접 파싱)

- Option B는 토큰/비용 데이터를 제공할 수 없어 PRD 핵심 요구사항 미충족
- Option A의 리스크(포맷 변경)는 버전 감지 + graceful fallback으로 완화 가능
- 성능 이슈는 스트리밍 파싱 + timestamp 기반 조기 종료로 해결

---

## 5. 수정 권고사항 (우선순위별)

### P0 (구현 전 반드시 수정)

1. **로그 파싱 경로 및 구조 전면 수정**
   - `~/.claude/logs/` -> `~/.claude/projects/{encoded-path}/{session-id}/` 하위 JSONL
   - 보조 소스: `~/.claude/transcripts/{session_id}.jsonl`
   - JSONL 레코드 구조: `type: "assistant"` 메시지의 `message.usage` 객체에서 토큰 추출
   - 세션 식별: `sessionId` 필드 기준

2. **비용 계산 로직 추가**
   - `message.model` 필드에서 모델명 추출
   - 모델별 토큰 단가 테이블 정의 (input/output/cache 각각)
   - `cost_usd = (input_tokens * input_price) + (output_tokens * output_price) + (cache_read * cache_read_price) + (cache_creation * cache_creation_price)`

3. **usage_minutes 산출 방식 명확화**
   - 세션 내 첫 메시지 timestamp ~ 마지막 메시지 timestamp 차이
   - 유휴 시간 30분 이상이면 분리 세션으로 간주 (옵션)

### P1 (Phase 1 완료 전 수정)

4. **DUPLICATE_PERIOD 처리 통일**
   - 권장: 서버에서 upsert (기존 데이터 덮어쓰기) + 200 OK 반환

5. **cron 설정 시 절대 경로 사용**
   - `which npx` 결과를 cron 라인에 반영
   - 예: `0 * * * * /usr/local/bin/npx ai-challenge sync`

6. **Windows 지원 범위 결정**
   - Phase 1에서는 macOS/Linux만 지원하고, Windows는 Phase 3 이후로 연기 권장

### P2 (Phase 2 이전 수정)

7. **`is_me` 필드 구현 방안 정의**
   - 웹에서 닉네임을 로컬스토리지에 저장, 쿼리 파라미터 `?me={nickname}`으로 전달

8. **Pagination 추가**
   - `GET /api/v1/leaderboard`에 `offset` 파라미터 추가

### P3 (Phase 3 또는 이후)

9. **에러 메시지 영문화** (npm 글로벌 배포 대비)
10. **닉네임 변경/계정 삭제 API** 추가
11. **API 키 rotation 메커니즘** 추가

---

## 6. 구현 계획 (Phase별, PRD 수정사항 반영)

### Phase 1 (Week 1): 핵심 데이터 파이프라인

**Step 1: 프로젝트 초기화 + DB 스키마**
- Next.js 15 프로젝트 생성 (App Router, Tailwind CSS 4)
- Supabase 프로젝트 생성 + Users/Records 테이블 + RLS 정책
- 인덱스: Records(user_id, period_start), Users(api_key), Users(nickname)
- AC: `supabase db push` 성공, 테이블 생성 확인

**Step 2: API 엔드포인트 구현**
- POST /api/v1/register (닉네임 검증 + UUID 발급 + DB 저장)
- POST /api/v1/record (Bearer 인증 + 데이터 저장 + upsert for duplicate period)
- 입력 검증 (zod schema), 에러 응답 규격화
- AC: curl로 register -> record -> 중복 record 테스트 통과

**Step 3: CLI 패키지 구현 (ai-challenge)**
- `init` 커맨드: 닉네임 프롬프트 + register API + config.json 저장 + cron 설정
- `sync` 커맨드: **실제 Claude Code JSONL 파싱** + 토큰 집계 + 비용 계산 + API 전송 + 큐 처리
- `status` 커맨드: last_sync.json 읽기 + 다음 cron 시각 계산
- 모델별 토큰 단가 테이블 내장
- AC: 로컬에서 init -> sync -> status 전체 플로우 동작 확인

### Phase 2 (Week 2): 웹 리더보드 UI

**Step 4: 리더보드 API + 캐싱**
- GET /api/v1/leaderboard (기간/메트릭 필터 + Supabase 집계 쿼리)
- GET /api/v1/profile/[nickname] (일별 집계 + 순위 계산)
- Vercel KV 5분 TTL 캐싱 (또는 Supabase 캐싱 fallback)
- AC: API 응답이 PRD 명세와 일치, 캐싱 동작 확인

**Step 5: 웹 페이지 구현**
- 메인 리더보드 (`/`): 다크 모드, 기간/메트릭 탭, 순위 테이블, 상위 3위 배지
- 프로필 페이지 (`/profile/[nickname]`): 요약 카드 + Recharts 7일 차트
- 반응형 (Mobile/Tablet/Desktop)
- TanStack Query로 서버 상태 관리
- AC: Lighthouse Performance 90+, 모바일 레이아웃 정상

### Phase 3 (Week 3): 완성도 향상

**Step 6: 순위 변동 + 공유 + 배포**
- 순위 변동 계산 (24시간 전 순위 대비)
- 공유 URL 복사 기능
- npm 배포 (`npm publish`)
- README 작성
- AC: npm install 후 npx ai-challenge init 동작, 순위 변동 표시 확인

---

## 7. ADR (Architecture Decision Record)

### Decision
Transcript JSONL 직접 파싱 방식 (Option A) 채택

### Drivers
1. PRD 핵심 메트릭(토큰/비용)은 transcript JSONL에서만 추출 가능
2. stats-cache.json에는 토큰 데이터가 없어 Option B 불가
3. 사용자 온보딩 3분 목표 달성을 위해 자동화된 파싱 필수

### Alternatives Considered
- Option B (stats-cache 기반): 토큰/비용 데이터 부재로 기각

### Why Chosen
유일하게 PRD 핵심 요구사항(4가지 메트릭)을 충족할 수 있는 방식

### Consequences
- Claude Code 업데이트 시 파서 유지보수 필요
- 대용량 로그 처리를 위한 스트리밍 파싱 구현 필요
- 모델별 토큰 단가 테이블 자체 관리 필요

### Follow-ups
- Claude Code 버전별 JSONL 구조 변경 추적 체계 구축
- 토큰 단가 자동 업데이트 메커니즘 (향후)
- 공식 Claude Code API 제공 시 마이그레이션 계획
