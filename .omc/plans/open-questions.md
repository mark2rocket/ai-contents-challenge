# Open Questions

## AI Challenge Leaderboard PRD - 2026-03-09

- [ ] Claude Code JSONL 구조가 버전에 따라 다를 수 있는가? 버전별 차이점 문서화 필요 — 파서 안정성에 직결
- [ ] `~/.claude/projects/` 하위 경로 인코딩 규칙(`-Users-kimsaeam-cc-playground-BFM` 형태)이 공식 문서화되어 있는가? — 프로젝트별 세션 탐색 로직 구현에 필요
- [ ] npm 패키지명 `ai-challenge`가 이미 등록되어 있는가? 대안명 필요 여부 — Phase 3 npm 배포 시 블로커 가능
- [ ] Windows 지원을 Phase 1에 포함할 것인가, 이후로 연기할 것인가? — cron vs Task Scheduler 구현 분기
- [ ] Vercel KV 무료 티어(30MB, 일 30,000 요청)가 초기 사용자 규모에 충분한가? Supabase 캐싱 fallback 필요 여부 — 인프라 비용 결정
- [ ] 모델별 토큰 단가를 하드코딩할 것인가, 설정 파일로 분리할 것인가? 업데이트 주기는? — 비용 계산 정확도와 유지보수 비용 트레이드오프
- [ ] 유휴 시간을 usage_minutes에 포함할 것인가? 포함 시 임계값(예: 30분)은? — 사용 시간 메트릭의 의미와 정확도
- [ ] DUPLICATE_PERIOD 시 upsert(덮어쓰기)와 reject(거부) 중 어느 방식을 채택할 것인가? — 데이터 정합성 정책
