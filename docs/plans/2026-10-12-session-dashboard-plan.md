# 세션 분석 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로컬 Claude Code 세션 로그를 증분 import해 토큰 사용량 대시보드와 세션 타임라인을 보여주고, 익명화한 스냅샷으로 읽기 전용 데모를 배포한다.

**Architecture:** `src/core`(parser·importer·pricing·anonymizer)는 Next.js에 의존하지 않는 순수 TS 모듈이고, CLI 스크립트와 Route Handler가 같은 core를 호출한다. 저장소는 Prisma 6 + `@prisma/adapter-libsql` 하나로 로컬 SQLite 파일과 데모 Turso를 모두 다룬다. 화면은 클라이언트 TanStack Query가 Route Handler를 조회하고, 필터는 URL 쿼리 파라미터에 둔다.

**Tech Stack:** Next.js(App Router, `create-next-app@latest`), TypeScript, Tailwind, TanStack Query v5, Prisma 6, `@prisma/adapter-libsql`, `@libsql/client`, Recharts, sonner, Vitest, tsx

**Spec:** `docs/specs/2026-10-12-session-dashboard-design.md` (원본 아티팩트 https://claude.ai/artifact/9wDtE4U2m15RfTZosxuzC2)

## 실행 방식: C (하이브리드)

- **Task 1~8 (core, 쿼리, API):** 사용자가 직접 구현한다. Claude는 코드를 대신 쓰지 않고 태스크 요약, 요청 시 힌트, 디버깅, 리뷰만 한다. 리뷰는 코드 수정 없이 파일·라인 단위로 지적한다.
- **Task 9~13 (화면, 데모 스크립트, 배포):** Claude가 이 계획대로 구현하고 사용자가 리뷰한다.
- "Task N 시작" → Claude는 해당 태스크의 목표, 인터페이스, 주의점을 짧게 정리한다. "리뷰해줘" → 현재 diff를 이 계획과 비교해 리뷰한다.
- Step이 끝날 때마다 `docs/plans/2026-10-12-session-dashboard-plan.md`의 해당 체크박스를 `- [x]`로 바꾼다. 커밋은 테스트가 통과하는 의미 단위마다 한다(실패 테스트만 있는 상태는 커밋하지 않는다). 각 태스크의 마지막 "Commit" Step은 남은 변경을 커밋하는 단계로 본다.
- 새 세션이나 다른 컴퓨터에서 시작할 때: repo의 `CLAUDE.md`(실행 방식), `docs/plans/2026-10-12-session-dashboard-plan.md`(계획 원문), `docs/specs/2026-10-12-session-dashboard-design.md`(설계서)를 읽는다. repo 문서가 기준이고, 아티팩트(계획 https://claude.ai/artifact/FZ1RXJbHEc71FVKZhie6wn, 설계서 https://claude.ai/artifact/9wDtE4U2m15RfTZosxuzC2)는 공유용 사본이다.

## Global Constraints

- 프로젝트 위치: repo 루트(`tokentrail/`). 이미 만든 git repo 폴더에 `create-next-app`을 현재 폴더(`.`)로 설치한다
- Node 20 이상 (`fs.readdir(..., { recursive: true })` 사용)
- 패키지 매니저는 pnpm. 의존성 추가는 `pnpm add`, 로컬 바이너리 실행은 `pnpm <bin>`(예: `pnpm prisma`, `pnpm vitest`), 일회성 실행은 `pnpm dlx`
- Prisma는 6.x로 고정: `prisma@6`, `@prisma/client@6`, `@prisma/adapter-libsql@6`
- `@libsql/client`는 `^0.8`: `@prisma/adapter-libsql@6`의 의존 범위가 `^0.8`까지라, 더 높이면 클라이언트와 네이티브 바이너리가 두 벌 설치된다
- `src/core/**`는 `next`, `react`, `src/app/**`, `src/server/**`를 import하지 않는다
- tool_result·thinking 본문은 DB에 저장하지 않는다. `preview` 최대 500자, `inputSummary` 최대 200자 (코드 포인트 기준)
- cache write는 TTL별 단가가 달라 `ApiCall`에 `cacheWrite5mTokens`·`cacheWrite1hTokens`로 나눠 저장한다(Task 2 Step 0). 화면·세션 합계의 `cacheWriteTokens`는 둘의 합이다
- 총 토큰 = `inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens`(= 5m + 1h)
- 날짜 버킷은 설정의 `timezone`(기본 `Asia/Seoul`) 기준. 서버 TZ에 의존하지 않는다
- `APP_MODE=demo`에서는 DB 쓰기 없음. `POST /api/sync`, 원본 보기 API는 403
- 실제 로그 파일, `data/`, `demo-snapshot.json`은 커밋하지 않는다 (`.gitignore`)
- 화면 문구는 한국어
- 자명한 주석 금지
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

## Review Focus

1. **서버 TZ와 사용자 TZ가 다름** (Vercel은 UTC): `2026-10-11T16:30:00Z` 호출은 `Asia/Seoul` 기준 `2026-10-12` 막대에 들어가야 한다 → Task 6 테스트
2. **멀티바이트 UTF-8 + 쓰는 중인 마지막 줄**: 한글 본문이 있고 파일이 줄 중간에서 끝나도 깨진 글자 없이 완성된 줄만 읽고 offset은 바이트 기준 → Task 4 테스트
3. **서브에이전트 파일이 부모 세션 파일보다 먼저 import됨**: 서브에이전트 줄로 Session이 생성되고, 이후 메인 파일이 제목·브랜치를 채운다. 중복 세션 없음 → Task 5 테스트
4. **단가표에 없는 모델** (`<synthetic>`, 신규 모델): 비용 합계에서 빠지고 `unpricedModels`에 나열되며 화면은 "일부 모델 단가 없음"을 표시 → Task 2, Task 6 테스트
5. **세션 도중 cwd가 바뀜**: 세션은 처음 본 cwd의 프로젝트에 남고 새 세션·프로젝트가 생기지 않는다 → Task 5 테스트
6. **이전 대화가 다른 세션 파일로 복사됨** (spec 2절 "세션 간 중복 처리"): 같은 `message.id`·`uuid`가 여러 세션 파일에 있다. 세션마다 저장하고(복합키), 한 파일을 다시 읽어도 다른 세션 데이터가 지워지지 않으며, 전체 집계에서는 `messageId` 기준으로 한 번만 센다 → Task 5, Task 6 테스트

## File Structure

```
tokentrail/
  dashboard.config.ts              사용자 설정 (단가, 구독료, timezone, 자동 sync, 데모 allowlist·별칭)
  prisma/schema.prisma
  prisma/migrations/
  src/core/config.ts               DashboardConfig 타입, loadConfig()
  src/core/pricing.ts              estimateCostUsd()
  src/core/time.ts                 toDateKey(), dateKeysBetween()
  src/core/parser/types.ts         내부 표준 타입
  src/core/parser/parseLine.ts     JSONL 한 줄 → ParsedLine
  src/core/parser/summarize.ts     summarizeToolInput(), truncate()
  src/core/importer/scan.ts        scanLogFiles()
  src/core/importer/readLines.ts   readCompleteLines()
  src/core/importer/importFile.ts  importFile()
  src/core/importer/sync.ts        runSync()
  src/core/importer/raw.ts         readRawLine()
  src/core/anonymizer/redact.ts    redactText()
  src/core/anonymizer/snapshot.ts  buildSnapshot(), DemoSnapshot
  src/core/anonymizer/push.ts      pushSnapshot()
  src/core/db/createDb.ts          createDb(), applyMigrations()
  src/server/db.ts                 getDb() 싱글턴 (모드별 URL)
  src/server/mode.ts               getAppMode()
  src/server/params.ts             쿼리 파라미터 파싱
  src/server/queries/overview.ts
  src/server/queries/filters.ts
  src/server/queries/sessions.ts
  src/server/queries/sessionDetail.ts
  src/app/api/...                  Route Handler
  src/app/(dashboard)/...          화면
  src/components/...               화면 컴포넌트
  src/lib/api.ts                   fetcher, queryKeys
  scripts/sync.ts | demo-export.ts | demo-push.ts
  tests/fixtures/*.jsonl           손으로 만든 로그 fixture
  tests/helpers/testDb.ts          createTestDb()
```

---

### Task 1: 프로젝트 세팅, Prisma 스키마, 테스트 DB 헬퍼

**Files:**
- Create: 프로젝트 전체 골격, `prisma/schema.prisma`, `src/core/db/createDb.ts`, `src/server/db.ts`, `src/server/mode.ts`, `tests/helpers/testDb.ts`, `vitest.config.ts`, `.env.example`
- Copy: spec·plan 마크다운 → `docs/specs/`, `docs/plans/`
- Test: `tests/core/db.test.ts`

**Interfaces:**
- Produces:
  - `createDb(url: string, authToken?: string): PrismaClient` (libsql adapter 사용, `file:`·`libsql://` 모두)
  - `applyMigrations(client: import('@libsql/client').Client): Promise<void>` (`prisma/migrations/*/migration.sql`을 디렉터리 이름순으로 `executeMultiple`)
  - `getDb(): PrismaClient` (local: `DATABASE_URL`(`.env`에 절대경로로 둔다, 아래 Step 3 참고). 값이 없으면 `.env` 설정을 안내하는 메시지로 throw. demo: `TURSO_DATABASE_URL`·`TURSO_AUTH_TOKEN`)
  - `getAppMode(): 'local' | 'demo'` (`APP_MODE`, 기본 `local`)
  - `createTestDb(): Promise<{ db: PrismaClient; url: string; cleanup: () => Promise<void> }>` (OS 임시 디렉터리에 새 파일 + applyMigrations)

- [x] **Step 1: 프로젝트 생성과 git 초기화**

```bash
pnpm create next-app@latest . --ts --tailwind --app --src-dir --eslint --import-alias "@/*" --use-pnpm
pnpm add @tanstack/react-query recharts sonner @prisma/client@6 @prisma/adapter-libsql@6 @libsql/client@^0.8
pnpm add -D prisma@6 vitest tsx @types/node
mkdir -p docs/specs docs/plans data
```
설치 중 "Ignored build scripts" 경고가 나오면 `pnpm approve-builds`로 Prisma 관련 패키지(`prisma`, `@prisma/client`, `@prisma/engines`)의 설치 스크립트를 허용한다.
spec·plan 마크다운을 `docs/` 아래로 복사한다. `.gitignore`에 `/data/`, `*.db`, `*.db-journal`, `demo-snapshot.json`, `.env*`와 예외 `!.env.example` 추가.

- [x] **Step 2: 설치된 Prisma 6 버전에서 driver adapter 사용법 확인**

Prisma 공식 문서 Turso/SQLite 페이지(https://www.prisma.io/docs/orm/v6/overview/databases/turso)를 보고, 설치된 버전에 `previewFeatures = ["driverAdapters"]`가 필요한지와 `PrismaLibSQL` 생성자 시그니처(config 객체 vs client 인스턴스)를 확인해 아래 Step 3·4에 반영한다.

> 확인 결과 (6.19.3, 2026-10-15)
> - `previewFeatures = ["driverAdapters"]`: 필요 없음. `driverAdapters`는 5.4.0 preview, 6.16.0에서 GA. Step 3 `generator` 블록에 넣지 않는다.
> - `PrismaLibSQL`: config 객체를 받는다. `index-node.d.ts`의 `constructor(config: Config, options?: PrismaLibSQLOptions)`. Step 6 `createDb`는 `new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken }) })`.
> - adapter의 내부 클라이언트는 밖에서 쓸 수 없으므로 `applyMigrations`는 `@libsql/client`의 `createClient`로 별도 클라이언트를 만들어 받는다.
> - 공식 예시의 `./generated/prisma` import는 새 `prisma-client` generator용이다. 이 계획은 `prisma-client-js`라 `@prisma/client`에서 import한다.

- [x] **Step 3: `prisma/schema.prisma` 작성**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Project {
  id       String    @id @default(cuid())
  cwd      String    @unique
  name     String
  sessions Session[]
}

model Session {
  id               String          @id
  projectId        String
  project          Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title            String?
  gitBranch        String?
  cliVersion       String?
  startedAt        DateTime
  endedAt          DateTime
  inputTokens      Int             @default(0)
  outputTokens     Int             @default(0)
  cacheReadTokens  Int             @default(0)
  cacheWriteTokens Int             @default(0)
  totalTokens      Int             @default(0)
  subagentCount    Int             @default(0)
  apiCalls         ApiCall[]
  events           TimelineEvent[]

  @@index([startedAt])
  @@index([totalTokens])
}

model ApiCall {
  sessionId        String
  messageId        String
  session          Session      @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  agentId          String?
  sourceFileId     String
  sourceFile       ImportedFile @relation(fields: [sourceFileId], references: [id], onDelete: Cascade)
  model            String
  timestamp        DateTime
  inputTokens      Int
  outputTokens     Int
  cacheReadTokens  Int
  cacheWriteTokens Int              // Task 2 Step 0에서 cacheWrite5mTokens·cacheWrite1hTokens로 분리
  stopReason       String?
  skill            String?
  plugin           String?

  @@id([sessionId, messageId])
  @@index([timestamp])
  @@index([messageId])
}

model TimelineEvent {
  uuid          String
  sessionId     String
  session       Session      @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  agentId       String?
  parentUuid    String?
  apiCallId     String?
  sourceFileId  String
  sourceFile    ImportedFile @relation(fields: [sourceFileId], references: [id], onDelete: Cascade)
  timestamp     DateTime
  kind          String
  toolName      String?
  inputSummary  String?
  isError       Boolean      @default(false)
  contentLength Int          @default(0)
  preview       String?

  @@id([sessionId, uuid])
  @@index([sessionId, timestamp])
}

model ImportedFile {
  id         String          @id @default(cuid())
  path       String          @unique
  size       Int
  mtimeMs    Float
  byteOffset Int
  importedAt DateTime        @updatedAt
  apiCalls   ApiCall[]
  events     TimelineEvent[]
}
```

먼저 루트 `.env`에 `DATABASE_URL="file:<repo 절대경로>/data/dashboard.db"`를 넣고, 같은 형식의 자리표시자를 `.env.example`에 둔다. Prisma CLI는 SQLite 상대경로를 `prisma/` 기준으로, 앱(libsql adapter)은 실행 위치 기준으로 풀기 때문에 상대경로를 쓰면 마이그레이션 DB와 앱 DB가 서로 다른 파일이 된다.

Run: `pnpm prisma migrate dev --name init` (CLI가 루트 `.env`를 자동으로 읽는다)
Expected: `prisma/migrations/<ts>_init/migration.sql` 생성, 루트 `data/dashboard.db` 생성, `prisma/data/`는 생기지 않음

- [x] **Step 4: 실패하는 테스트 작성** — `tests/core/db.test.ts`

```ts
test('createTestDb는 마이그레이션이 적용된 빈 DB를 만든다', async () => {
  const { db, cleanup } = await createTestDb();
  const p = await db.project.create({ data: { cwd: '/x', name: 'x' } });
  expect(await db.project.count()).toBe(1);
  expect(p.cwd).toBe('/x');
  await cleanup();
});
```

- [x] **Step 5: 실행해 실패 확인** — Run: `pnpm vitest run tests/core/db.test.ts` / Expected: FAIL (`createTestDb` 없음)

- [x] **Step 6: `createDb`, `applyMigrations`, `getDb`, `getAppMode`, `createTestDb` 구현.** `package.json` scripts에 `"test": "vitest run"`, `"postinstall": "prisma generate"` 추가. `.env.example`에 `APP_MODE`, `DATABASE_URL`(절대경로 자리표시자), `CLAUDE_DIR`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`(빈 값). Task 2에서 `SUBSCRIPTION_MONTHLY_USD`(선택) 추가.

- [x] **Step 7: 통과 확인** — Run: `pnpm test` / Expected: PASS

- [x] **Step 8: Commit**

```bash
git add -A && git commit -m "chore: 프로젝트 세팅, Prisma 스키마, 테스트 DB 헬퍼"
```

---

### Task 2: 설정, 단가 계산, 날짜 유틸

**Files:**
- Create: `dashboard.config.ts`, `src/core/config.ts`, `src/core/pricing.ts`, `src/core/time.ts`
- Modify: `prisma/schema.prisma` (+ 새 마이그레이션)
- Test: `tests/core/pricing.test.ts`, `tests/core/time.test.ts`, `tests/core/config.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Rates = { input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }; // USD / 1M tokens
  type DashboardConfig = {
    timezone: string;
    subscriptionMonthlyUsd: number;
    autoSyncOnLoad: boolean;
    pricing: Record<string, Rates>;          // key = 모델 id 접두사
    demo: { projects: string[]; aliases: Record<string, string> }; // cwd 목록, cwd → 별칭
  };
  type TokenCounts = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWrite5mTokens: number; cacheWrite1hTokens: number };
  function loadConfig(): DashboardConfig; // SUBSCRIPTION_MONTHLY_USD 환경변수가 있으면 subscriptionMonthlyUsd를 덮어쓴다
  function estimateCostUsd(tokens: TokenCounts, model: string, pricing: Record<string, Rates>): number | null;
  function totalTokens(t: TokenCounts): number;
  function toDateKey(d: Date, timeZone: string): string;            // 'YYYY-MM-DD'
  function dateKeysBetween(from: Date, to: Date, timeZone: string): string[]; // 양 끝 포함
  ```

로그의 `message.usage.cache_creation`에 `ephemeral_5m_input_tokens`·`ephemeral_1h_input_tokens`가 따로 있고(2026-10-15 확인: 1h가 cache write의 약 87%), 1시간 TTL 단가가 5분보다 비싸다. 그래서 단가와 저장을 TTL별로 나눈다.

- [x] **Step 0: 스키마에서 cache write 분리.** `ApiCall.cacheWriteTokens`를 `cacheWrite5mTokens Int`, `cacheWrite1hTokens Int` 두 컬럼으로 바꾼다. `Session.cacheWriteTokens`는 표시용 합계라 그대로 둔다. Run: `pnpm prisma migrate dev --name split_cache_write` / Expected: `prisma/migrations/<ts>_split_cache_write/migration.sql` 생성, `pnpm test` PASS

- [x] **Step 1: 실패하는 테스트 작성**

```ts
const pricing = {
  'claude-a': { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 },
  'claude-a-long': { input: 1, output: 1, cacheRead: 1, cacheWrite5m: 1, cacheWrite1h: 1 },
};
const M = 1_000_000;
test('백만 토큰 단가로 계산한다', () => {
  expect(estimateCostUsd({ inputTokens: M, outputTokens: M, cacheReadTokens: M, cacheWrite5mTokens: M, cacheWrite1hTokens: M }, 'claude-a-2026', pricing)).toBeCloseTo(28.05);
});
test('가장 긴 접두사가 이긴다', () => {
  expect(estimateCostUsd({ inputTokens: M, outputTokens: 0, cacheReadTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0 }, 'claude-a-long-1', pricing)).toBeCloseTo(1);
});
test('단가 없는 모델은 null', () => {
  expect(estimateCostUsd({ inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0 }, '<synthetic>', pricing)).toBeNull();
});
test('toDateKey는 지정 TZ 기준', () => {
  expect(toDateKey(new Date('2026-10-11T16:30:00Z'), 'Asia/Seoul')).toBe('2026-10-12');
  expect(toDateKey(new Date('2026-10-11T16:30:00Z'), 'UTC')).toBe('2026-10-11');
});
test('dateKeysBetween은 양 끝 포함', () => {
  expect(dateKeysBetween(new Date('2026-10-10T00:00:00+09:00'), new Date('2026-10-12T23:59:59+09:00'), 'Asia/Seoul'))
    .toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);
});
```

- [x] **Step 2: 실행해 실패 확인** — Run: `pnpm vitest run tests/core/pricing.test.ts tests/core/time.test.ts` / Expected: FAIL

- [x] **Step 3: 구현.** `toDateKey`는 `Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' })`. `loadConfig`는 루트 `dashboard.config.ts`의 설정을 반환.

- [x] **Step 4: `dashboard.config.ts` 작성과 구독료 환경변수.** 회사(Team)·개인(Max) 계정을 주로 다른 컴퓨터에서 쓰므로, 구독료는 컴퓨터마다 `.env`의 `SUBSCRIPTION_MONTHLY_USD`로 덮어쓸 수 있게 한다. `dashboard.config.ts`의 값은 환경변수가 없을 때의 기본값이다. 환경변수는 문자열이라 숫자로 바꾸고, 숫자가 아닌 값일 때의 처리(throw 등)는 직접 정해 테스트를 추가한다. Team 플랜은 1인당 월 금액을 넣는다. `.env.example`에 `SUBSCRIPTION_MONTHLY_USD`(빈 값) 추가.

```ts
// tests/core/config.test.ts
test('SUBSCRIPTION_MONTHLY_USD가 있으면 구독료를 덮어쓴다', () => {
  vi.stubEnv('SUBSCRIPTION_MONTHLY_USD', '25');
  expect(loadConfig().subscriptionMonthlyUsd).toBe(25);
  vi.unstubAllEnvs();
});
```

설정 파일 값: `timezone: 'Asia/Seoul'`, `autoSyncOnLoad: false`, `demo: { projects: [], aliases: {} }`. `pricing`과 `subscriptionMonthlyUsd`는 Anthropic 공식 요금 페이지와 본인 구독 요금으로 채운다. 접두사가 겹치는 모델(`claude-opus-5`와 `claude-opus-5-5`, `claude-fable-5`와 `claude-fable-5-1`)은 단가가 다르면 둘 다 넣는다. 하나만 넣으면 긴 id도 짧은 쪽 단가로 조용히 계산된다. 대상 모델 목록은 Task 5 이후 `sqlite3 data/dashboard.db "select distinct model from ApiCall"`로 확인해 보완한다.

- [x] **Step 5: 통과 확인** — Run: `pnpm test` / Expected: PASS

- [x] **Step 6: Commit** — `git commit -am "feat: 설정, API 환산 비용, 날짜 버킷 유틸"` (새 파일은 `git add` 먼저)

---

### Task 3: Parser

**Files:**
- Create: `src/core/parser/types.ts`, `src/core/parser/summarize.ts`, `src/core/parser/parseLine.ts`
- Test: `tests/core/parser.test.ts` (fixture는 테스트 안에 객체 리터럴로 만들고 `JSON.stringify`)

**Interfaces:**
- Produces:
  ```ts
  type EventKind = 'user' | 'assistant_text' | 'thinking' | 'tool_use' | 'tool_result' | 'system';
  type LineContext = { sessionId: string; agentId: string | null; cwd: string; gitBranch: string | null; cliVersion: string | null; timestamp: Date };
  type ApiCallRecord = { messageId: string; sessionId: string; agentId: string | null; model: string; timestamp: Date;
    inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWrite5mTokens: number; cacheWrite1hTokens: number;
    stopReason: string | null; skill: string | null; plugin: string | null };
  type TimelineEventRecord = { uuid: string; sessionId: string; agentId: string | null; parentUuid: string | null;
    apiCallId: string | null; timestamp: Date; kind: EventKind; toolName: string | null; inputSummary: string | null;
    isError: boolean; contentLength: number; preview: string | null };
  type ParsedLine =
    | { status: 'ok'; sessionId: string; context: LineContext | null; title: string | null; titleSource: 'ai' | 'custom' | null; apiCall: ApiCallRecord | null; events: TimelineEventRecord[] }
    | { status: 'ignored' }
    | { status: 'malformed' };
  function parseLine(line: string): ParsedLine;
  function truncate(text: string, max: number): string;          // 코드 포인트 기준, 넘으면 끝에 '…'
  function summarizeToolInput(name: string, input: unknown): string | null;
  ```

로그 필드 매핑 (spec 2절에서 확인한 구조):

| 줄 | 결과 |
|---|---|
| JSON 파싱 실패 | `malformed` |
| `type: 'ai-title'` | `ok`, `title = aiTitle`, `titleSource = 'ai'`, `context = null`, 이벤트 없음 |
| `type: 'custom-title'` | `ok`, `title = customTitle`, `titleSource = 'custom'`, `context = null`, 이벤트 없음 (Task 5에서 추가) |
| `type: 'assistant'` | `context` + `apiCall`(`message.id`, `message.model`, `message.usage.*`, `message.stop_reason`, `attributionSkill`, `attributionPlugin`) + content 블록마다 이벤트 (`text`→`assistant_text`, `thinking`→`thinking`, `tool_use`→`tool_use`), 각 이벤트 `apiCallId = message.id` |
| `type: 'user'`, `isMeta !== true`, content가 문자열 또는 `text` 블록 | `user` 이벤트 |
| `type: 'user'`, content의 `tool_result` 블록 | `tool_result` 이벤트 (`isError = is_error === true`, `contentLength` = 본문 문자 수, `preview = null`) |
| `type: 'system'` | `system` 이벤트 (`preview = subtype`, `isError = level === 'error'`) |
| `type: 'user'` + `isMeta === true`, 그 외 모든 타입 | `ignored` |

- 한 줄에서 블록이 여러 개면 첫 블록은 줄의 `uuid`, 이후는 `${uuid}#${index}`.
- `agentId`는 줄의 `agentId` 필드(없으면 null).
- cache write: 합계 `total = usage.cache_creation_input_tokens ?? 0`을 기준으로 삼는다. `cacheWrite1hTokens = min(usage.cache_creation?.ephemeral_1h_input_tokens ?? 0, total)`, `cacheWrite5mTokens = total - cacheWrite1hTokens`. 그래서 `cache_creation` 객체나 키가 없으면 전부 5m가 되고, 두 값의 합은 항상 `total`과 같다.
  - 근거(2026-10-16 확인): assistant 줄 49,723개 중 49,697개는 `5m + 1h = total`이었다. 나머지 26개는 `total`·`input`·`output`이 모두 0인데 `ephemeral_1h_input_tokens`만 수백으로 남은 줄로, 같은 `message.id`의 뒤쪽 중복 줄(값이 비워진 줄)이다. TTL 값을 그대로 믿으면 이런 줄에서 없는 토큰이 생긴다.
- `thinking`: `contentLength` = 사고 본문 길이, `preview = null`.
- `summarizeToolInput`: `Bash`→`input.command`, `Read`·`Write`·`Edit`→`input.file_path`, `Grep`·`Glob`→`input.pattern`, `Agent`·`Task`→`input.description`, 그 외→`input`의 첫 문자열 값. 모두 `truncate(…, 200)`, 없으면 null.

- [x] **Step 1: 실패하는 테스트 작성**

```ts
test('assistant 줄은 apiCall과 이벤트를 만든다', () => {
  const r = parseLine(JSON.stringify(assistantLine({ id: 'msg_1', blocks: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }] })));
  expect(r.status).toBe('ok');
  expect(r.apiCall).toMatchObject({ messageId: 'msg_1', model: 'claude-a', inputTokens: 10, outputTokens: 5, cacheReadTokens: 100, cacheWrite5mTokens: 15, cacheWrite1hTokens: 5 });
  expect(r.events[0]).toMatchObject({ kind: 'tool_use', toolName: 'Bash', inputSummary: 'npm test', apiCallId: 'msg_1' });
});
test('cache_creation이 없으면 cache write 전부를 5m로 본다', () => {
  const line = assistantLine({ id: 'm0' });
  delete line.message.usage.cache_creation;
  expect(parseLine(JSON.stringify(line)).apiCall).toMatchObject({ cacheWrite5mTokens: 20, cacheWrite1hTokens: 0 });
});
test('TTL 키가 하나만 있으면 나머지는 합계에서 채운다', () => {
  const line = assistantLine({ id: 'm0' });
  line.message.usage.cache_creation = { ephemeral_5m_input_tokens: 20 };
  expect(parseLine(JSON.stringify(line)).apiCall).toMatchObject({ cacheWrite5mTokens: 20, cacheWrite1hTokens: 0 });
});
test('TTL 합이 cache_creation_input_tokens보다 크면 합계를 기준으로 자른다', () => {
  const line = assistantLine({ id: 'm0' });
  line.message.usage.cache_creation_input_tokens = 0;
  line.message.usage.cache_creation = { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 433 };
  expect(parseLine(JSON.stringify(line)).apiCall).toMatchObject({ cacheWrite5mTokens: 0, cacheWrite1hTokens: 0 });
});
test('tool_result는 본문을 저장하지 않는다', () => {
  const r = parseLine(JSON.stringify(userToolResult({ content: 'SECRET=abc'.repeat(10), is_error: true })));
  expect(r.events[0]).toMatchObject({ kind: 'tool_result', isError: true, contentLength: 100, preview: null });
  expect(JSON.stringify(r)).not.toContain('SECRET');
});
test('user 문자열 프롬프트는 500자 미리보기', () => {
  const r = parseLine(JSON.stringify(userText('가'.repeat(600))));
  expect(Array.from(r.events[0].preview!)).toHaveLength(501);
});
test('isMeta user, 모르는 타입은 ignored, 깨진 줄은 malformed', () => {
  expect(parseLine(JSON.stringify({ ...userText('x'), isMeta: true })).status).toBe('ignored');
  expect(parseLine(JSON.stringify({ type: 'file-history-snapshot' })).status).toBe('ignored');
  expect(parseLine('{"type":"assi').status).toBe('malformed');
});
test('서브에이전트 줄은 agentId를 가진다', () => {
  const r = parseLine(JSON.stringify({ ...assistantLine({ id: 'm2', blocks: [{ type: 'text', text: 'hi' }] }), agentId: 'a1' }));
  expect(r.apiCall!.agentId).toBe('a1');
  expect(r.events[0].agentId).toBe('a1');
});
test('ai-title 줄은 제목만 준다', () => {
  expect(parseLine(JSON.stringify({ type: 'ai-title', aiTitle: '세션 제목', sessionId: 's1' })))
    .toMatchObject({ status: 'ok', sessionId: 's1', title: '세션 제목', context: null, apiCall: null, events: [] });
});
test('블록이 여러 개면 uuid에 #index를 붙인다', () => {
  const r = parseLine(JSON.stringify(assistantLine({ id: 'm3', uuid: 'u1', blocks: [{ type: 'thinking', thinking: 'abc' }, { type: 'text', text: 'ok' }] })));
  expect(r.events.map(e => e.uuid)).toEqual(['u1', 'u1#1']);
  expect(r.events[0]).toMatchObject({ kind: 'thinking', contentLength: 3, preview: null });
});
```
`assistantLine`, `userText`, `userToolResult`는 테스트 파일 안의 fixture 빌더. 기본값: `sessionId: 's1'`, `cwd: '/Users/me/proj'`, `gitBranch: 'main'`, `version: '2.0.0'`, `timestamp: '2026-10-12T01:00:00Z'`, `model: 'claude-a'`, usage `{input_tokens:10, output_tokens:5, cache_read_input_tokens:100, cache_creation_input_tokens:20, cache_creation:{ephemeral_5m_input_tokens:15, ephemeral_1h_input_tokens:5}}`.

- [x] **Step 2: 실패 확인** — Run: `pnpm vitest run tests/core/parser.test.ts` / Expected: FAIL
- [x] **Step 3: 위 매핑대로 구현**
- [x] **Step 4: 통과 확인** — Run: `pnpm test` / Expected: PASS
- [x] **Step 5: Commit** — `"feat: JSONL parser와 종류별 저장 정책"`

---

### Task 4: 파일 스캔과 이어 읽기

**Files:**
- Create: `src/core/importer/scan.ts`, `src/core/importer/readLines.ts`
- Test: `tests/core/readLines.test.ts`, `tests/core/scan.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type ScannedFile = { path: string; size: number; mtimeMs: number };
  function scanLogFiles(claudeDir: string): Promise<ScannedFile[]>;  // <claudeDir>/projects 아래 모든 *.jsonl, 경로 오름차순. claudeDir의 선행 '~'는 홈으로 확장
  function readCompleteLines(path: string, fromOffset: number): Promise<{ lines: string[]; nextOffset: number }>;
  ```

- [x] **Step 1: 실패하는 테스트 작성**

```ts
test('마지막 개행까지만 읽고 바이트 offset을 돌려준다', async () => {
  const p = tmpFile('{"a":"한글"}\n{"b":1}\n{"c":"쓰는');
  const r = await readCompleteLines(p, 0);
  expect(r.lines).toEqual(['{"a":"한글"}', '{"b":1}']);
  expect(r.nextOffset).toBe(Buffer.byteLength('{"a":"한글"}\n{"b":1}\n'));
});
test('offset 이후만 읽는다', async () => {
  const p = tmpFile('{"a":1}\n{"b":2}\n');
  expect((await readCompleteLines(p, Buffer.byteLength('{"a":1}\n'))).lines).toEqual(['{"b":2}']);
});
test('개행이 없으면 아무것도 읽지 않고 offset 유지', async () => {
  expect(await readCompleteLines(tmpFile('{"a":'), 0)).toEqual({ lines: [], nextOffset: 0 });
});
test('scanLogFiles는 서브에이전트 파일까지 찾는다', async () => {
  const dir = tmpTree({ 'projects/p/s1.jsonl': '', 'projects/p/s1/subagents/agent-x.jsonl': '', 'projects/p/s1/subagents/agent-x.meta.json': '{}' });
  expect((await scanLogFiles(dir)).map(f => path.relative(dir, f.path)))
    .toEqual(['projects/p/s1.jsonl', 'projects/p/s1/subagents/agent-x.jsonl']);
});
```

- [x] **Step 2: 실패 확인** — Run: `pnpm vitest run tests/core/readLines.test.ts tests/core/scan.test.ts` / Expected: FAIL
- [x] **Step 3: 구현.** `readCompleteLines`는 `fs.open` 후 `fromOffset`부터 끝까지 Buffer로 읽고 `lastIndexOf(0x0a)`까지만 `utf8`로 디코드한다(문자열로 먼저 디코드하지 않는다). 빈 줄은 버린다.
- [x] **Step 4: 통과 확인** — Run: `pnpm test` / Expected: PASS
- [x] **Step 5: Commit** — `"feat: 로그 파일 스캔과 바이트 offset 이어 읽기"`

---

### Task 5: Import, sync, CLI

**Files:**
- Create: `src/core/importer/importFile.ts`, `src/core/importer/sync.ts`, `scripts/sync.ts`, `tests/helpers/fixtures.ts`
- Modify: `prisma/schema.prisma`(+ 마이그레이션), `src/core/parser/types.ts`, `src/core/parser/parseLine.ts`, `tests/core/parser.test.ts`
- Test: `tests/core/importer.test.ts`

**진행 방식(B, 2026-10-20 결정):** `importFile`과 custom-title 처리(parser·스키마)는 Claude가 구현하고 설명한다. fixture 빌더 이동, importer 테스트, `runSync`, `scripts/sync.ts`는 사용자가 구현한다.

**제목 규칙(2026-10-20 결정):** 로그에는 사용자가 붙인 `custom-title` 줄이 `ai-title`보다 훨씬 많다(세션 161개 중 custom 131개, ai 10개). 제목은 `custom-title`을 우선한다. 같은 세션에서 여러 번 바뀌면 마지막 값을 쓴다. `ai-title`은 `custom-title`로 정한 제목을 덮어쓰지 않는다. 증분 sync에서도 이 규칙을 지키려고 `Session.titleSource`(`'ai' | 'custom' | null`)에 제목 출처를 저장한다.

**Interfaces:**
- Consumes: `parseLine` (Task 3), `scanLogFiles`, `readCompleteLines` (Task 4), `createTestDb` (Task 1)
- Produces:
  ```ts
  type FileImportResult = { status: 'new' | 'appended' | 'reimported' | 'unchanged'; newApiCalls: number; newEvents: number; skippedLines: number };
  type SyncSummary = { filesScanned: number; filesImported: number; newApiCalls: number; newEvents: number; skippedLines: number };
  function importFile(db: PrismaClient, file: ScannedFile): Promise<FileImportResult>;
  function runSync(db: PrismaClient, claudeDir: string): Promise<SyncSummary>;
  ```

`importFile` 처리 순서:
1. `ImportedFile`을 path로 조회해 spec 3절 표대로 상태 결정. `reimported`면 그 파일의 `ApiCall`·`TimelineEvent`를 지우고 offset 0.
2. `readCompleteLines` → 줄마다 `parseLine`. `malformed`는 `skippedLines`에 집계, `ignored`는 집계하지 않는다.
3. 세션별로 모은다: 처음 본 `context`(cwd, 그리고 처음 나온 null 아닌 gitBranch·cliVersion), 최소·최대 timestamp, 제목 규칙에 따른 `title`·`titleSource`, `ApiCallRecord`는 `messageId` 기준 Map(중복 줄 usage는 동일하므로 먼저 들어온 것 유지).
4. 트랜잭션 하나에서: Project upsert(`cwd`, `name = path.basename(cwd)`) → Session upsert(없으면 생성. 있으면 `startedAt=min`, `endedAt=max`, `title`은 제목 규칙대로(새 값이 custom이면 항상, ai면 기존 출처가 custom이 아닐 때만), `gitBranch`·`cliVersion`은 기존 값이 null일 때만, `projectId`는 바꾸지 않음) → ApiCall·TimelineEvent 삽입. 구현은 `sourceFileId`가 먼저 필요해 ImportedFile upsert(`size`, `mtimeMs`, `byteOffset = nextOffset`)를 맨 앞에서 하고, 세션별로 기존 키(`sessionId`+`messageId`, `sessionId`+`uuid`)를 IN으로 조회(500개 단위)한 뒤 `createMany`로 새 행만 넣는다. 행마다 upsert하면 실제 로그 수만 행에서 너무 느리다.
5. 영향받은 세션의 합계 재계산: ApiCall 합계(`inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens = cacheWrite5mTokens + cacheWrite1hTokens`), `totalTokens`, `subagentCount = agentId 중 null 아닌 고유 수`.

`context` 없이 `title`만 있는 세션(파일에 ai-title·custom-title만 새로 추가된 경우)은 Session이 이미 있을 때만 제목을 갱신한다. Session이 없어 버린 경우에는 `byteOffset`을 앞으로 보내지 않고 다음 sync에서 같은 구간을 다시 읽는다(코드 리뷰 2026-10-20: 실제 로그 249개 중 51개 파일에서 제목 줄이 첫 context 줄보다 앞에 있음). 이미 저장한 행은 키로 걸러져 결과는 같다.

`appended`인데 새로 읽은 완성된 줄이 없으면(쓰는 중인 마지막 줄만 늘어난 경우) 트랜잭션 없이 `unchanged`로 돌려준다.

- [x] **Step 0: custom-title 처리 (Claude).** `ParsedLine`에 `titleSource` 추가, `parseLine`이 `custom-title` 줄을 처리, parser 테스트 추가. `Session`에 `titleSource String?` 추가 → `pnpm prisma migrate dev --name add_title_source`.

- [x] **Step 1: 실패하는 테스트 작성** (fixture는 임시 `claudeDir/projects/p/` 아래에 Task 3 빌더로 줄을 써서 만든다)

```ts
test('중복 message.id는 한 번만 집계된다', async () => {
  writeLog('p/s1.jsonl', [assistantLine({ id: 'm1', uuid: 'u1', blocks: [{ type: 'thinking', thinking: 'x' }] }),
                          assistantLine({ id: 'm1', uuid: 'u2', blocks: [{ type: 'text', text: 'y' }] })]);
  await runSync(db, dir);
  expect(await db.apiCall.count()).toBe(1);
  expect((await db.session.findUniqueOrThrow({ where: { id: 's1' } })).totalTokens).toBe(135);
  expect(await db.timelineEvent.count()).toBe(2);
});
test('두 번 sync해도 결과가 같다', async () => {
  writeLog('p/s1.jsonl', [userText('hi'), assistantLine({ id: 'm1' })]);
  await runSync(db, dir);
  const second = await runSync(db, dir);
  expect(second).toMatchObject({ filesImported: 0, newApiCalls: 0, newEvents: 0 });
});
test('이어 쓴 줄만 새로 읽는다', async () => {
  writeLog('p/s1.jsonl', [userText('hi')]);
  await runSync(db, dir);
  appendLog('p/s1.jsonl', [assistantLine({ id: 'm2' })]);
  expect(await runSync(db, dir)).toMatchObject({ filesImported: 1, newApiCalls: 1 });
});
test('파일이 줄어들면 그 파일 데이터를 지우고 다시 읽는다', async () => {
  writeLog('p/s1.jsonl', [assistantLine({ id: 'm1' }), assistantLine({ id: 'm2' })]);
  await runSync(db, dir);
  writeLog('p/s1.jsonl', [assistantLine({ id: 'm3' })]);
  await runSync(db, dir);
  expect((await db.apiCall.findMany()).map(a => a.messageId)).toEqual(['m3']);
});
test('다른 세션 파일에 복사된 호출은 세션마다 저장되고, 한쪽 재import가 다른 쪽을 지우지 않는다', async () => {
  writeLog('p/s1.jsonl', [assistantLine({ id: 'm1', uuid: 'u1' })]);
  writeLog('p/s2.jsonl', [{ ...assistantLine({ id: 'm1', uuid: 'u1' }), sessionId: 's2' }, { ...assistantLine({ id: 'm2', uuid: 'u2' }), sessionId: 's2' }]);
  await runSync(db, dir);
  expect(await db.apiCall.count()).toBe(3);
  expect(await db.timelineEvent.count({ where: { uuid: 'u1' } })).toBe(2);
  expect((await db.session.findUniqueOrThrow({ where: { id: 's2' } })).totalTokens).toBe(270);
  writeLog('p/s2.jsonl', [{ ...assistantLine({ id: 'm3', uuid: 'u3' }), sessionId: 's2' }]);
  await runSync(db, dir);
  expect((await db.apiCall.findMany({ where: { sessionId: 's1' } })).map(a => a.messageId)).toEqual(['m1']);
});
test('깨진 줄은 건너뛰고 센다', async () => {
  writeLog('p/s1.jsonl', ['{"type":', JSON.stringify(userText('ok'))]);
  expect((await runSync(db, dir)).skippedLines).toBe(1);
});
test('서브에이전트 파일이 먼저 import돼도 세션 하나로 합쳐진다', async () => {
  writeLog('p/a/s1/subagents/agent-x.jsonl', [{ ...assistantLine({ id: 'm9' }), agentId: 'x', gitBranch: null }]);
  writeLog('p/z/s1.jsonl', [{ type: 'ai-title', aiTitle: '제목', sessionId: 's1' }, assistantLine({ id: 'm1' })]);
  await runSync(db, dir);
  const s = await db.session.findUniqueOrThrow({ where: { id: 's1' } });
  expect(await db.session.count()).toBe(1);
  expect(s).toMatchObject({ title: '제목', gitBranch: 'main', subagentCount: 1, totalTokens: 270 });
});
test('세션 도중 cwd가 바뀌어도 첫 프로젝트에 남는다', async () => {
  writeLog('p/s1.jsonl', [userText('a'), { ...userText('b'), uuid: 'u-b', cwd: '/Users/me/other' }]);
  await runSync(db, dir);
  expect(await db.session.count()).toBe(1);
  expect((await db.session.findFirstOrThrow({ include: { project: true } })).project.cwd).toBe('/Users/me/proj');
});
```
(마지막 두 테스트는 Review Focus 3·5, 복사 테스트는 Review Focus 6. 서브에이전트 테스트는 경로 정렬상 `p/a/...`가 `p/z/...`보다 먼저 import되도록 배치했다.)

- [x] **Step 2: 실패 확인** — Run: `pnpm vitest run tests/core/importer.test.ts` / Expected: FAIL
- [x] **Step 3: 위 처리 순서대로 `importFile`, `runSync` 구현**
- [x] **Step 4: `scripts/sync.ts` 구현.** `CLAUDE_DIR`(기본 `~/.claude`)로 `runSync(getDb(), …)` 실행 후 `SyncSummary`를 한 줄로 출력. `package.json`에 `"sync": "tsx --env-file=.env scripts/sync.ts"`. `.env`가 없으면 `.env.example`을 복사해 만들고, `DATABASE_URL`을 repo 절대경로로 수정한다.
- [x] **Step 5: 통과 확인** — Run: `pnpm test` / Expected: PASS
- [x] **Step 6: 실제 로그로 확인** — Run: `pnpm run sync` 두 번 / Expected: 첫 실행에서 `filesScanned`가 `find ~/.claude/projects -name '*.jsonl' | wc -l`과 같고 `newApiCalls > 0`, 두 번째 실행은 `filesImported: 0`(진행 중인 세션 파일은 1 이하)
- [x] **Step 7: Commit** — `"feat: 증분 import, runSync, pnpm run sync"`

**1주차 완료 기준:** Step 6 통과.

---

### Task 6: 대시보드 집계 쿼리와 필터 옵션

**Files:**
- Create: `src/server/queries/overview.ts`, `src/server/queries/filters.ts`
- Test: `tests/server/overview.test.ts`

**Interfaces:**
- Consumes: `estimateCostUsd`, `totalTokens`, `toDateKey`, `dateKeysBetween`, `DashboardConfig` (Task 2)
- Produces:
  ```ts
  type OverviewParams = { from: Date; to: Date; projectId?: string; model?: string };
  type DailyTokens = { date: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }; // cacheWrite = 5m + 1h
  type Overview = {
    totalTokens: number; sessionCount: number; activeDays: number;
    estimatedCostUsd: number; unpricedModels: string[]; subscriptionMonthlyUsd: number;
    daily: DailyTokens[];                                   // 범위 내 모든 날짜, 없는 날은 0
    byProject: { projectId: string; name: string; totalTokens: number }[];  // 내림차순 상위 8
    byModel: { model: string; totalTokens: number }[];      // 내림차순
    topSessions: { id: string; title: string | null; projectName: string; totalTokens: number }[]; // 범위 내 토큰 기준 상위 5
  };
  function getOverview(db: PrismaClient, params: OverviewParams, config: DashboardConfig): Promise<Overview>;
  type FilterOptions = { projects: { id: string; name: string }[]; models: string[]; lastImportedAt: string | null };
  function getFilterOptions(db: PrismaClient): Promise<FilterOptions>;
  ```

집계 방식: `ApiCall`을 범위·필터 조건으로 `findMany`(필요 컬럼과 `session.projectId`만 select)한 뒤 TS에서 버킷팅한다. 날짜 SQL 함수를 쓰지 않아 SQLite·Turso·TZ 차이를 피한다.

- `totalTokens`, `estimatedCostUsd`, `unpricedModels`, `daily`, `byProject`, `byModel`, `activeDays`: `messageId` 기준으로 중복을 제거한 행으로 계산한다. 대표 행은 `sessionId` 사전순 첫 행(프로젝트 귀속에만 영향).
- `sessionCount`, `topSessions`: 세션 단위라 중복 제거 전 행으로 계산한다(세션 파일에 기록된 호출 전부).
- 프로젝트 필터(코드 리뷰 2026-10-20): `projectId`는 DB `where`에 넣지 않는다. 기간·모델로 가져온 행에서 대표 행을 **전체 기준으로** 고른 뒤 대표 행의 프로젝트로 거른다. 그래야 "p2만 보기"의 합계가 필터 없는 화면의 p2 막대와 같다. 세션 단위 지표는 세션의 프로젝트로 거른다.
- 행마다 세션 제목·프로젝트 이름을 가져오지 않는다. 합계는 `session.projectId`로 내고, 이름·제목은 화면에 나갈 상위 8 프로젝트·상위 5 세션만 따로 조회한다.
- 정렬은 합계 내림차순, 같으면 키 오름차순(동점이 상위 N 경계에 걸려도 결과가 매번 같게).
- Task 8 메모: `to`를 `23:59:59`로 넘기면 마지막 999ms가 빠진다. API에서 `23:59:59.999`로 만들지 다음 날 0시 + `lt`로 할지 정한다. 조회 범위 상한도 입력 검증에서 둔다.

- [x] **Step 1: 실패하는 테스트 작성** (테스트 DB에 Prisma로 직접 행을 넣는 `seed()` 헬퍼를 `tests/helpers/seed.ts`에 만든다. Task 7·12·13도 이 파일을 쓴다)

```ts
const config = { ...baseConfig, timezone: 'Asia/Seoul', pricing: { 'claude-a': { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 } } };
test('TZ 기준으로 날짜를 나눈다', async () => {
  await seed(db, [{ id: 'm1', session: 's1', model: 'claude-a', at: '2026-10-11T16:30:00Z', input: 100 }]);
  const o = await getOverview(db, { from: new Date('2026-10-11T00:00:00+09:00'), to: new Date('2026-10-12T23:59:59+09:00') }, config);
  expect(o.daily).toEqual([
    { date: '2026-10-11', inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    { date: '2026-10-12', inputTokens: 100, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  ]);
});
test('단가 없는 모델은 비용에서 빠지고 목록에 나온다', async () => {
  await seed(db, [{ id: 'm1', session: 's1', model: 'claude-a', at: '2026-10-12T01:00:00Z', input: 1_000_000 },
                  { id: 'm2', session: 's1', model: '<synthetic>', at: '2026-10-12T01:00:00Z', input: 5 }]);
  const o = await getOverview(db, range, config);
  expect(o.estimatedCostUsd).toBeCloseTo(3);
  expect(o.unpricedModels).toEqual(['<synthetic>']);
  expect(o.totalTokens).toBe(1_000_005);
});
test('세션 간 복사된 호출은 전체 집계에서 한 번만 센다', async () => {
  await seed(db, [{ id: 'm1', session: 's1', model: 'claude-a', at: '2026-10-12T01:00:00Z', input: 100 },
                  { id: 'm1', session: 's2', model: 'claude-a', at: '2026-10-12T01:00:00Z', input: 100 },
                  { id: 'm2', session: 's2', model: 'claude-a', at: '2026-10-12T02:00:00Z', input: 10 }]);
  const o = await getOverview(db, range, config);
  expect(o.totalTokens).toBe(110);
  expect(o.sessionCount).toBe(2);
  expect(o.topSessions.map(t => [t.id, t.totalTokens])).toEqual([['s2', 110], ['s1', 100]]);
});
test('프로젝트·모델 필터', async () => { /* s1(p1, claude-a), s2(p2, claude-b) 시드 → projectId=p1이면 sessionCount 1, model=claude-b면 byModel이 claude-b만 */ });
test('빈 DB는 0과 빈 배열', async () => {
  const o = await getOverview(db, range, config);
  expect(o).toMatchObject({ totalTokens: 0, sessionCount: 0, activeDays: 0, estimatedCostUsd: 0, byProject: [], topSessions: [] });
});
test('getFilterOptions', async () => { /* 프로젝트 이름순, 모델 고유 정렬, ImportedFile 없으면 lastImportedAt null */ });
```
"프로젝트·모델 필터"와 "getFilterOptions"는 주석에 적힌 시드와 기대값 그대로 작성한다.

- [x] **Step 2: 실패 확인** — Run: `pnpm vitest run tests/server/overview.test.ts` / Expected: FAIL
- [x] **Step 3: 구현**
- [x] **Step 4: 통과 확인** — Run: `pnpm test` / Expected: PASS
- [x] **Step 5: Commit** — `"feat: 대시보드 집계 쿼리와 필터 옵션"`

---

### Task 7: 세션 목록과 세션 상세 쿼리

**Files:**
- Create: `src/server/queries/sessions.ts`, `src/server/queries/sessionDetail.ts`
- Test: `tests/server/sessions.test.ts`

**Interfaces:**
- Consumes: `estimateCostUsd` (Task 2), `tests/helpers/seed.ts` (Task 6, `seedSessions`·`seedTimeline`·`ev` 추가)
- Produces:
  ```ts
  type SessionListParams = { projectId?: string; model?: string; from?: Date; to?: Date; sort: 'recent' | 'tokens'; cursor?: string; limit?: number }; // limit 기본 20
  type SessionListItem = { id: string; title: string | null; projectName: string; gitBranch: string | null;
    startedAt: string; endedAt: string; totalTokens: number; subagentCount: number };
  function listSessions(db: PrismaClient, p: SessionListParams): Promise<{ items: SessionListItem[]; nextCursor: string | null }>;

  type TimelineEventView = Omit<TimelineEventRecord, 'timestamp'> & { timestamp: string; tokens: { input: number; output: number } | null };
  type Turn = { id: string; events: TimelineEventView[] };
  type SessionDetail = { session: SessionListItem & { estimatedCostUsd: number; unpricedModels: string[];
      inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }; turns: Turn[] };
  function getSessionDetail(db: PrismaClient, id: string, config: DashboardConfig): Promise<SessionDetail | null>;
  ```

- 정렬: `recent`는 `[startedAt desc, id desc]`, `tokens`는 `[totalTokens desc, id desc]`. Prisma `cursor: { id }, skip: 1`. `limit + 1`개를 읽어 다음 커서 판단.
- `model` 필터는 `apiCalls: { some: { model } }`, 기간은 `startedAt` 기준.
- 턴 묶기: 이벤트를 `timestamp`, 같으면 `uuid` 오름차순 정렬. `agentId === null`인 `user` 이벤트마다 새 턴(`id` = 그 uuid). 첫 user 이전 이벤트는 `id: 'start'` 턴.
- `tokens`: 같은 세션의 ApiCall(`sessionId`, `messageId = apiCallId`)을 쓴다. 같은 `apiCallId`를 가진 이벤트 중 첫 이벤트에만 `{ input: inputTokens + cacheReadTokens + cacheWrite5mTokens + cacheWrite1hTokens, output: outputTokens }`, 나머지는 null.

- `limit`은 쿼리에서 1~50으로 묶는다(API를 거치지 않는 호출도 보호). 토큰 배지·비용은 ApiCall 행을 `TokenCounts`로 그대로 넘긴다(칼럼 이름이 같다).

- [x] **Step 1: 실패하는 테스트 작성**

```ts
test('커서 페이지네이션으로 겹치지 않게 넘긴다', async () => {
  await seedSessions(db, 25);
  const p1 = await listSessions(db, { sort: 'recent' });
  const p2 = await listSessions(db, { sort: 'recent', cursor: p1.nextCursor! });
  expect(p1.items).toHaveLength(20);
  expect(p2.items).toHaveLength(5);
  expect(p2.nextCursor).toBeNull();
  expect(new Set([...p1.items, ...p2.items].map(i => i.id)).size).toBe(25);
});
test('토큰순 정렬과 모델 필터', async () => { /* s1 100 tokens claude-a, s2 300 tokens claude-b → tokens 정렬 [s2, s1], model=claude-a → [s1] */ });
test('턴 묶기와 토큰 배지', async () => {
  await seedTimeline(db, 's1', [
    ev('e0', 'system', '01:00'), ev('e1', 'user', '01:01'),
    ev('e2', 'thinking', '01:02', { apiCallId: 'm1' }), ev('e3', 'assistant_text', '01:02', { apiCallId: 'm1' }),
    ev('e4', 'tool_use', '01:03', { apiCallId: 'm2', agentId: 'x' }), ev('e5', 'user', '01:04', { agentId: 'x' }),
    ev('e6', 'user', '01:05'),
  ], [{ id: 'm1', input: 10, cacheRead: 90, output: 5 }, { id: 'm2', input: 1, output: 1 }]);
  const d = await getSessionDetail(db, 's1', config);
  expect(d!.turns.map(t => [t.id, t.events.map(e => e.uuid)])).toEqual([
    ['start', ['e0']], ['e1', ['e1', 'e2', 'e3', 'e4', 'e5']], ['e6', ['e6']],
  ]);
  expect(d!.turns[1].events[1].tokens).toEqual({ input: 100, output: 5 });
  expect(d!.turns[1].events[2].tokens).toBeNull();
});
test('없는 세션은 null', async () => { expect(await getSessionDetail(db, 'nope', config)).toBeNull(); });
```

- [x] **Step 2: 실패 확인** — Run: `pnpm vitest run tests/server/sessions.test.ts` / Expected: FAIL
- [x] **Step 3: 구현**
- [x] **Step 4: 통과 확인** — Run: `pnpm test` / Expected: PASS
- [x] **Step 5: Commit** — `"feat: 세션 목록·상세 쿼리"`

---

### Task 8: API Route Handler와 모드 가드

**Files:**
- Create: `src/server/params.ts`, `src/core/importer/raw.ts`, `src/app/api/overview/route.ts`, `src/app/api/filters/route.ts`, `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/route.ts`, `src/app/api/sync/route.ts`, `src/app/api/sessions/[id]/events/[uuid]/raw/route.ts`
- Test: `tests/server/params.test.ts`, `tests/server/routes.test.ts`, `tests/core/raw.test.ts`

**Interfaces:**
- Consumes: Task 5 `runSync`, Task 6·7 쿼리, Task 1 `getDb`, `getAppMode`
- Produces:
  ```ts
  function parseOverviewParams(sp: URLSearchParams, now: Date, timeZone: string): OverviewParams;
  //  range=7d|30d (기본 7d): 오늘(timeZone) 포함 7·30일, from=해당 날짜 00:00, to=now
  //  from=YYYY-MM-DD&to=YYYY-MM-DD 가 있으면 range보다 우선, timeZone 기준 하루 시작·끝
  //  project, model → projectId, model
  function parseSessionListParams(sp: URLSearchParams, now: Date, timeZone: string): SessionListParams; // sort 기본 'recent'
  //  두 함수는 날짜 처리를 parseDateRange(sp, now, timeZone)로 공유한다. FilterBar가 대시보드와 세션 목록에 같은 URL 값(range 또는 from·to)을 쓰므로 같은 URL이면 같은 기간이 나와야 한다.
  //  날짜 계산은 src/core/time.ts의 startOfDayInZone·endOfDayInZone·addDays를 쓴다.
  function readRawLine(filePath: string, uuid: string): Promise<unknown | null>; // uuid의 '#n' 접미사 제거 후 그 uuid를 가진 줄의 JSON 객체
  ```
  | Route | 응답 |
  |---|---|
  | `GET /api/overview?…` | `Overview` |
  | `GET /api/filters` | `FilterOptions` |
  | `GET /api/sessions?…` | `{ items, nextCursor }` |
  | `GET /api/sessions/[id]` | `SessionDetail`, 없으면 404 |
  | `POST /api/sync` | `SyncSummary`, demo면 403 `{ error: '데모에서는 sync를 사용할 수 없습니다.' }` |
  | `GET /api/sessions/[id]/events/[uuid]/raw` | `{ line: unknown }`, demo면 403, 이벤트·줄이 없으면 404 (`uuid`는 세션 간에 겹치므로 세션 id와 함께 찾는다) |

- 입력 검증(코드 리뷰 2026-10-23): `from`·`to`가 형식이 틀리거나 없는 날짜(`2026-02-31`)면 400 대신 기본 range로 대체한다(`sort`·`limit`과 같은 방식). `readRawLine`은 파일이 없으면(ENOENT) `null`을 돌려 raw route가 404를 낸다. `startOfDayInZone`은 서머타임 전환일에 오프셋을 한 번 더 보정한다. `CLAUDE_DIR` 기본값은 `getClaudeDir()`(`src/core/importer/sync.ts`) 하나를 쓴다.

Route 파일은 파라미터 파싱 → 쿼리 호출 → `Response.json`만 한다. 이 프로젝트는 `next.config.ts`에서 `cacheComponents: true`라 `export const dynamic`을 쓸 수 없다(Next 16 문서: route segment config에서 제거됨). GET은 요청 시점 실행이 기본이고, 요청 객체를 읽지 않는 GET(`/api/filters`)은 빌드 때 미리 실행되지 않도록 첫 줄에서 `await connection()`(`next/server`)을 부른다. POST는 캐시되지 않는다.

- [x] **Step 1: 실패하는 테스트 작성**

```ts
test('range=7d는 오늘 포함 7일', () => {
  const p = parseOverviewParams(new URLSearchParams('range=7d'), new Date('2026-10-12T03:00:00Z'), 'Asia/Seoul');
  expect(p.from.toISOString()).toBe('2026-10-05T15:00:00.000Z');
  expect(p.to.toISOString()).toBe('2026-10-12T03:00:00.000Z');
});
test('from/to가 range보다 우선', () => {
  const p = parseOverviewParams(new URLSearchParams('range=30d&from=2026-10-01&to=2026-10-02'), new Date('2026-10-12T03:00:00Z'), 'Asia/Seoul');
  expect([p.from.toISOString(), p.to.toISOString()]).toEqual(['2026-09-30T15:00:00.000Z', '2026-10-02T14:59:59.999Z']);
});
test('demo 모드에서 sync와 raw는 403', async () => {
  vi.stubEnv('APP_MODE', 'demo');
  expect((await syncPOST()).status).toBe(403);
  expect((await rawGET(new Request('http://x'), { params: Promise.resolve({ id: 's1', uuid: 'u1' }) })).status).toBe(403);
});
test('readRawLine은 #접미사를 떼고 원본 줄을 찾는다', async () => {
  const p = await tmpFile([JSON.stringify({ uuid: 'u0' }), JSON.stringify({ uuid: 'u1', message: { content: '전체' } })].join('\n') + '\n');
  expect(await readRawLine(p, 'u1#2')).toEqual({ uuid: 'u1', message: { content: '전체' } });
  expect(await readRawLine(p, 'zz')).toBeNull();
});
```
Route의 `params` 형태(Promise 여부)는 설치된 Next.js 버전의 Route Handler 문서를 따른다.

- [x] **Step 2: 실패 확인** — Run: `pnpm vitest run tests/server tests/core/raw.test.ts` / Expected: FAIL
- [x] **Step 3: 구현**
- [x] **Step 4: 통과 확인** — Run: `pnpm test` / Expected: PASS
- [x] **Step 5: 수동 확인** — Run: `pnpm dev` 후 `curl -s localhost:3000/api/overview | head -c 300`, `curl -s -XPOST localhost:3000/api/sync` / Expected: JSON 응답, sync 결과 요약
- [x] **Step 6: Commit** — `"feat: 조회·sync·원본 보기 API와 demo 가드"`

---

### Task 9: 앱 셸과 대시보드 화면

**Files:**
- Create: `src/app/providers.tsx`, `src/lib/api.ts`, `src/lib/useUrlFilters.ts`, `src/components/AppHeader.tsx`, `src/components/SyncButton.tsx`, `src/components/DemoBanner.tsx`, `src/components/FilterBar.tsx`, `src/components/dashboard/KpiCards.tsx`, `src/components/dashboard/DailyTokensChart.tsx`, `src/components/dashboard/ProjectTokens.tsx`, `src/components/dashboard/ModelShare.tsx`, `src/components/dashboard/TopSessions.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/page.tsx`
- Modify: `src/app/layout.tsx`
- Test: 수동 확인

**Interfaces:**
- Consumes: Task 8 API 응답 타입 (`import type`으로 `src/server/queries/*`에서 가져온다)
- Produces:
  ```ts
  const queryKeys = { overview: (p: Record<string,string>) => ['overview', p], filters: ['filters'],
    sessions: (p: Record<string,string>) => ['sessions', p], session: (id: string) => ['session', id] } as const;
  function useUrlFilters(): { values: Record<string, string>; set: (patch: Record<string, string | null>) => void }; // router.replace, 스크롤 유지
  function Providers(props: { mode: 'local' | 'demo'; autoSync: boolean; children: React.ReactNode }): JSX.Element;
  function useAppMode(): 'local' | 'demo';
  ```

- [x] **Step 1: `Providers`.** `QueryClient`(staleTime 30초), sonner `<Toaster />`, 모드 context. `mode === 'local' && autoSync`면 마운트 시 1회 `POST /api/sync` 후 `invalidateQueries()`.
- [x] **Step 2: 루트 layout**은 서버에서 `getAppMode()`와 `loadConfig().autoSyncOnLoad`를 읽어 `Providers`에 넘긴다.
- [x] **Step 3: `AppHeader`**(앱 이름, 대시보드·세션 링크, `SyncButton`), demo면 `DemoBanner`("실제 사용 데이터 · 본문 일부 마스킹")를 보여주고 Sync 버튼은 숨긴다. `SyncButton`은 `useMutation` → 성공 시 `invalidateQueries()`와 토스트 "새 이벤트 {newEvents}개, API 호출 {newApiCalls}개를 가져왔습니다", 실패 시 토스트 "Sync에 실패했습니다: {message}".
- Sync 주의(Task 8 리뷰): 서버에는 동시 실행 가드가 없다. 두 sync가 겹치면 같은 offset을 읽어 기본키 충돌(500)이 날 수 있으므로 `SyncButton`은 `isPending` 동안 비활성화하고, 자동 sync가 도는 중에도 같은 mutation 상태를 보게 한다. 처리되지 않은 예외는 Next 기본 500(JSON 아님)이라 실패 토스트는 응답 본문이 JSON이 아닐 때도 메시지를 만들어야 한다.
- [x] **Step 4: `FilterBar`**: 기간 세그먼트(7일/30일/직접 선택 → from·to date input), 프로젝트·모델 select(`/api/filters`), "마지막 데이터 반영 {상대 시각}". 값은 `useUrlFilters`.
- [x] **Step 5: 대시보드 위젯.** 토큰 4종 색은 spec 아티팩트와 같게 Tailwind 테마 변수로 정의(`--tok-in`, `--tok-out`, `--tok-cr`, `--tok-cw`).
  - `KpiCards`: 총 토큰, 세션 수, 활동일, API 환산(`≈ $x`, 아래에 `구독료 대비 {estimatedCostUsd ÷ (subscriptionMonthlyUsd × 기간 일수 ÷ 30)}배`, `unpricedModels`가 있으면 "일부 모델 단가 없음")
  - `DailyTokensChart`: Recharts `BarChart` 누적 4종, 범례
  - 구현 메모(2026-10-27):
    - 토큰 색: 설계서 색은 dataviz 검증에서 cache read 초록의 채도 미달(회색처럼 보임), 다크 모드 명도 범위 이탈로 실패해 검증을 통과한 값으로 바꿨다. input 파랑, output 주황, cache read 청록, cache write 노랑. 누적 순서는 cache read → cache write → input → output(맞닿는 색끼리 색각 이상에서도 구분).
    - `ModelShare`는 도넛 대신 가로 막대(비율 %와 토큰 수를 직접 표기). 모델마다 색을 새로 붙이면 토큰 4종 색과 의미가 겹치고, 조각이 많으면 각도로 비교하기 어렵다.
    - 토큰이 0인 모델(`<synthetic>`)은 비율 막대와 "일부 모델 단가 없음" 표시에서 뺀다.
    - sync 상태는 `useSync`/`useIsSyncing`(`mutationKey: ['sync']`)으로 버튼과 자동 sync가 공유한다.
    - `/`는 빌드 때 정적 셸로 미리 렌더링되므로 `APP_MODE`·`autoSyncOnLoad`는 빌드 시점 값이 들어간다. 배포(Task 13)에서는 빌드 환경 변수에 `APP_MODE=demo`가 있어야 한다.
  - `ProjectTokens`: 가로 막대, `ModelShare`: 가로 막대(구현 메모 참고), `TopSessions`: 링크 목록 → `/sessions/[id]`
  - 빈 상태(`sessionCount === 0`): 프로젝트가 하나라도 있으면(`/api/filters`의 `projects`) "선택한 기간·필터에 해당하는 데이터가 없습니다."(코드 리뷰 2026-10-27, demo 스냅샷에는 `ImportedFile`이 없을 수 있어 `lastImportedAt`으로 판단하지 않는다). DB가 비었으면 local은 "아직 가져온 세션이 없습니다. 상단 Sync를 누르거나 터미널에서 pnpm run sync를 실행하세요.", demo는 "표시할 데모 데이터가 없습니다."
  - 로딩은 스켈레톤, 에러는 "데이터를 불러오지 못했습니다" + 다시 시도 버튼(`refetch`). 이미 보이던 데이터가 있으면 다시 불러오기가 실패해도 화면을 유지하고 안내 한 줄만 붙인다.
- [x] **Step 6: 수동 확인** — Run: `pnpm dev`, `http://localhost:3000` / Expected: 7일·30일 전환 시 URL과 차트가 바뀜, 새로고침해도 필터 유지, Sync 후 토스트·숫자 갱신, `APP_MODE=demo pnpm dev`에서 배너 표시·Sync 숨김. 같은 기간을 `sqlite3`로 합산한 총 토큰과 KPI가 일치
- [ ] **Step 7: Commit** — `"feat: 앱 셸과 사용량 대시보드"`

**2주차 완료 기준:** Step 6 통과.

---

### Task 10: 세션 목록 화면

**Files:**
- Create: `src/app/(dashboard)/sessions/page.tsx`, `src/components/sessions/SessionTable.tsx`
- Test: 수동 확인

**Interfaces:**
- Consumes: `GET /api/sessions`, `useUrlFilters`, `FilterBar` (Task 9)

- 필터·정렬이 바뀌면 커서를 버리고 첫 페이지부터 다시 읽는다(코드 리뷰 2026-10-22). 이전 커서 행이 새 필터에서 빠져 있으면 `skip: 1`이 정상 행을 건너뛸 수 있다. 필터·정렬 값을 `queryKey`에 넣으면 된다.

- [ ] **Step 1: 구현.** `useInfiniteQuery`(`getNextPageParam = last.nextCursor`), `placeholderData: keepPreviousData`. 컬럼: 제목(없으면 "제목 없음"), 프로젝트, 브랜치, 시작 시각(`timezone` 기준 `MM.DD HH:mm`), 소요 시간(`1h 05m`), 토큰(`1.2M` 축약), 서브에이전트 수. 정렬 토글 최신순/토큰순(`sort` URL 파라미터). 행 클릭 → 상세. 하단 "더 보기" 버튼.
- [ ] **Step 2: 수동 확인** — Expected: 필터 변경 중 이전 목록이 유지되다 교체됨, 더 보기로 중복 없이 이어짐, 토큰순 정렬 동작
- [ ] **Step 3: Commit** — `"feat: 세션 목록 화면"`

---

### Task 11: 세션 상세 타임라인 화면

**Files:**
- Create: `src/app/(dashboard)/sessions/[id]/page.tsx`, `src/components/session/SessionHeader.tsx`, `src/components/session/Timeline.tsx`, `src/components/session/EventRow.tsx`, `src/components/session/RawViewer.tsx`
- Test: 수동 확인

**Interfaces:**
- Consumes: `GET /api/sessions/[id]`, `GET /api/sessions/[id]/events/[uuid]/raw`, `useAppMode` (Task 9)

- [ ] **Step 1: 구현.**
  - `SessionHeader`: 제목 · 프로젝트 · 브랜치 · 소요 시간 · 총 토큰 · `≈ $x`
  - 숨김 토글 thinking·system(`hide` URL 파라미터, 기본 숨김 없음)
  - `EventRow` 표시 규칙: `user` 프롬프트 강조 배경, `assistant_text` 미리보기, `tool_use` "툴 이름 + `inputSummary`(mono)", `tool_result` "✓/✗ + 길이(KB)", `thinking` "생각함 ({contentLength}자)", `system` subtype. 오른쪽에 `tokens` 배지 `{input} in / {output} out`
  - `agentId`가 있는 이벤트는 들여쓰기 + 왼쪽 선 + `[agent {agentId 앞 6자}]` 라벨
  - local 모드에서만 각 행에 "원본 보기" → `RawViewer`가 `/api/sessions/[id]/events/[uuid]/raw`를 조회해(uuid의 `#n`이 URL fragment로 잘리지 않게 `encodeURIComponent`) `JSON.stringify(line, null, 2)`를 접이식 `<pre>`로 표시
  - 404면 "세션을 찾을 수 없습니다" + 목록 링크
- [ ] **Step 2: 수동 확인** — Expected: 서브에이전트를 쓴 세션에서 들여쓰기·라벨 표시, 원본 보기에 전체 본문, thinking 숨김 토글 동작, demo 모드에서 원본 보기 없음
- [ ] **Step 3: Commit** — `"feat: 세션 상세 타임라인과 원본 보기"`

**3주차 완료 기준:** Step 2 통과.

---

### Task 12: 익명화와 데모 스냅샷 export

**Files:**
- Create: `src/core/anonymizer/redact.ts`, `src/core/anonymizer/snapshot.ts`, `scripts/demo-export.ts`
- Test: `tests/core/anonymizer.test.ts`

**Interfaces:**
- Consumes: `DashboardConfig['demo']` (Task 2), `tests/helpers/seed.ts` (Task 6·7, 이 Task에서 `seedFullSession` 추가)
- Produces:
  ```ts
  type RedactOptions = { homeDir: string; username: string; projectRoot: string | null };
  function redactText(text: string, o: RedactOptions): string;
  type DemoSnapshot = { version: 1; exportedAt: string;
    projects: Project[]; sessions: Session[]; apiCalls: Omit<ApiCall, 'sourceFileId'>[]; events: Omit<TimelineEvent, 'sourceFileId'>[] };
  function buildSnapshot(db: PrismaClient, demo: DashboardConfig['demo'], o: Omit<RedactOptions, 'projectRoot'>): Promise<DemoSnapshot>;
  ```

치환 순서(`redactText`):
1. `/sk-[A-Za-z0-9_-]{16,}/g`, `/gh[pousr]_[A-Za-z0-9]{20,}/g`, `/AKIA[0-9A-Z]{16}/g`, `/Bearer\s+[A-Za-z0-9._~+\/=-]+/g` → `[REDACTED]`
2. 이메일 `/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g` → `[REDACTED]`
3. `projectRoot + '/'` → `''`, `projectRoot` 단독 → `.`
4. `homeDir` → `~`
5. 남은 `username` 단어(`\b` 경계) → `user`

`buildSnapshot`: `demo.projects`(cwd)에 속한 프로젝트·세션·호출·이벤트만. `Project.cwd`와 `name`은 `aliases[cwd] ?? 'project-N'`. Session `title`·`gitBranch`, Event `preview`·`inputSummary`는 `redactText`(projectRoot = 그 세션 프로젝트의 원래 cwd). 숫자·모델·툴 이름·isError·timestamp는 그대로.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
const o = { homeDir: '/Users/me', username: 'me', projectRoot: '/Users/me/Sites/app' };
test.each([
  ['key sk-ant-abcdefghijklmnop1234', 'key [REDACTED]'],
  ['token ghp_abcdefghijklmnopqrstuvwxyz', 'token [REDACTED]'],
  ['Authorization: Bearer eyJhbGciOi.abc', 'Authorization: [REDACTED]'],
  ['mail pco@example.com', 'mail [REDACTED]'],
  ['Read /Users/me/Sites/app/src/a.ts', 'Read src/a.ts'],
  ['cd /Users/me/Desktop/other', 'cd ~/Desktop/other'],
  ['whoami → me', 'whoami → user'],
])('redactText(%s)', (input, expected) => expect(redactText(input, o)).toBe(expected));

test('allowlist가 비면 아무것도 내보내지 않는다', async () => {
  await seedFullSession(db, { cwd: '/Users/me/Sites/app' });
  const s = await buildSnapshot(db, { projects: [], aliases: {} }, o);
  expect([s.projects, s.sessions, s.apiCalls, s.events].every(a => a.length === 0)).toBe(true);
});
test('allowlist 프로젝트만, 별칭과 마스킹 적용, 숫자 보존', async () => {
  await seedFullSession(db, { cwd: '/Users/me/Sites/app', preview: 'sk-ant-abcdefghijklmnop1234 in /Users/me/Sites/app/x.ts', input: 42 });
  await seedFullSession(db, { cwd: '/Users/me/work/secret', sessionId: 's2' });
  const s = await buildSnapshot(db, { projects: ['/Users/me/Sites/app'], aliases: { '/Users/me/Sites/app': 'side-project-a' } }, o);
  expect(s.projects).toEqual([expect.objectContaining({ cwd: 'side-project-a', name: 'side-project-a' })]);
  expect(s.sessions.map(x => x.id)).toEqual(['s1']);
  expect(s.events[0].preview).toBe('[REDACTED] in x.ts');
  expect(s.apiCalls[0].inputTokens).toBe(42);
  expect(JSON.stringify(s)).not.toMatch(/\/Users\/me|secret|sourceFileId/);
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm vitest run tests/core/anonymizer.test.ts` / Expected: FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: `scripts/demo-export.ts`.** `buildSnapshot(getDb(), loadConfig().demo, { homeDir: os.homedir(), username: os.userInfo().username })`. 비어 있으면 "dashboard.config.ts의 demo.projects에 공개할 프로젝트 cwd를 추가하세요"를 출력하고 exit 1. 아니면 `demo-snapshot.json`에 쓰고 프로젝트·세션·이벤트 수 출력. `package.json`에 `"demo:export": "tsx --env-file=.env scripts/demo-export.ts"`.
- [ ] **Step 5: 통과 확인** — Run: `pnpm test` / Expected: PASS
- [ ] **Step 6: Commit** — `"feat: 데모용 익명화 스냅샷 export"`

---

### Task 13: 데모 push, Vercel 배포, README

**Files:**
- Create: `src/core/anonymizer/push.ts`, `scripts/demo-push.ts`, `README.md`
- Test: `tests/core/push.test.ts`

**Interfaces:**
- Consumes: `createDb`, `applyMigrations` (Task 1), `DemoSnapshot` (Task 12), `getOverview` (Task 6)
- Produces: `function pushSnapshot(url: string, authToken: string | undefined, s: DemoSnapshot): Promise<void>;`

`pushSnapshot`: `@libsql/client`로 접속 → `sqlite_master`에서 `sqlite_%`가 아닌 테이블을 모두 `DROP` → `applyMigrations` → `createDb`로 `ImportedFile { id: 'demo', path: 'demo', size: 0, mtimeMs: 0, byteOffset: 0 }` 생성 → project·session·apiCall·event를 `createMany`(500개 단위), `sourceFileId: 'demo'`.

- [ ] **Step 1: 실패하는 테스트 작성** (Turso 대신 임시 `file:` URL)

```ts
test('push한 DB에서 집계가 스냅샷과 같다', async () => {
  const url = `file:${tmpPath('demo.db')}`;
  await pushSnapshot(url, undefined, snapshotFixture);
  const o = await getOverview(createDb(url), wideRange, config);
  expect(o.totalTokens).toBe(sumTokens(snapshotFixture.apiCalls));
});
test('두 번 push해도 중복이 없다', async () => {
  const url = `file:${tmpPath('demo.db')}`;
  await pushSnapshot(url, undefined, snapshotFixture);
  await pushSnapshot(url, undefined, snapshotFixture);
  expect(await createDb(url).apiCall.count()).toBe(snapshotFixture.apiCalls.length);
});
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm vitest run tests/core/push.test.ts` / Expected: FAIL
- [ ] **Step 3: 구현.** `scripts/demo-push.ts`는 `demo-snapshot.json`을 읽어 `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`으로 `pushSnapshot`. `"demo:push": "tsx --env-file=.env scripts/demo-push.ts"`.
- [ ] **Step 4: 통과 확인** — Run: `pnpm test` / Expected: PASS
- [ ] **Step 5: Turso 준비 (수동).** Turso 가입 → DB 생성 → URL·토큰을 로컬 `.env`에 저장. `dashboard.config.ts`의 `demo.projects`·`aliases` 채우기 → `pnpm run demo:export` → `demo-snapshot.json`을 직접 열어 키·경로·회사 이름이 남았는지 검토 → `pnpm run demo:push`
- [ ] **Step 6: Vercel 배포 (수동).** GitHub에 push → Vercel 프로젝트 연결 → env `APP_MODE=demo`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` → 배포. 빌드나 런타임에서 libsql 관련 오류가 나면 Turso 공식 Prisma 가이드(https://docs.turso.tech/sdk/ts/orm/prisma)의 서버리스 설정을 따른다.
  Expected: 배포 URL에서 배너 표시, Sync·원본 보기 없음, 대시보드·목록·상세가 스냅샷 데이터로 동작, `curl -XPOST <url>/api/sync` → 403
- [ ] **Step 7: README.** 소개 한 단락, 데모 URL, 스크린샷 2장(대시보드, 세션 상세), 로컬 실행(`pnpm install` → `.env` 복사 후 `DATABASE_URL`을 절대경로로 수정 → `pnpm prisma migrate deploy` → `pnpm run sync` → `pnpm dev`), 설정 파일 설명, 데모 갱신 절차, "로그 포맷은 비공식이라 Claude Code 업데이트로 바뀔 수 있음"
- [ ] **Step 8: Commit** — `"feat: 데모 push, 배포 설정, README"`

**4주차 완료 기준:** Step 6 통과.

---

## 일정이 밀릴 때

spec 순서대로 뺀다: Task 11의 원본 보기(`RawViewer`, raw route) → Task 9의 `ModelShare` → Task 10의 토큰순 정렬. Task 12·13(데모)은 유지한다.
