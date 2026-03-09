#!/usr/bin/env node
import { argv } from "process";

const command = argv[2];

switch (command) {
  case "init":
    import("./commands/init.js").then((m) => m.init());
    break;
  case "sync":
    import("./commands/sync.js").then((m) => m.sync());
    break;
  case "status":
    import("./commands/status.js").then((m) => m.status());
    break;
  default:
    console.log(`
AI Challenge Leaderboard CLI

사용법:
  npx ai-challenge init    닉네임 등록 + 자동 전송 설정
  npx ai-challenge sync    지금 데이터 전송
  npx ai-challenge status  마지막 전송 상태 확인
`);
}
