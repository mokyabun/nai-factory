# 2. 데이터베이스

> 대상 문제: M1~M9, B1(스키마 측), B2(스키마 측), S2(비밀값 분리)
>
> 기존 데이터 이전은 하지 않는다(D1). 스키마와 마이그레이션을 처음부터 새로 만든다.

## 1. 공용 컬럼 규칙

```ts
// db/columns.ts
export const createdAt = () =>
    integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .$defaultFn(() => new Date())
export const updatedAt = () =>
    integer('updated_at', { mode: 'timestamp_ms' })
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
export const position = () => text('position').notNull() // fractional index key
```

- **시간**: `timestamp_ms` 정수(UTC). SQL 기본값 대신 `$defaultFn`을 쓴다. raw SQL에서 필요하면 `unixepoch('subsec')*1000`을 쓴다(Bun 내장 SQLite 3.43에서 동작 확인). (M4, M7)
- **정렬**: 순서가 있는 모든 리스트는 `position`(fractional index) 하나로 관리한다. **UNIQUE를 걸지 않고** `(parent_id, position, id)` 인덱스로 정렬하며, 같은 값은 id로 순서를 정한다. B2의 원인을 구조적으로 없앤다. (M6)
- **JSON 컬럼**: `text({ mode: 'json' }).$type<T>()`로 두되, `repo`에서 읽을 때 Zod 엔티티 스키마로 parse한다.
- **PK**: `integer primary key`(AUTOINCREMENT 없음).
- **FK**: 모두 `onDelete`를 명시한다. (M8)
- 싱글턴 테이블은 `CHECK (id = 1)`로 둔다.

## 2. 테이블

```
assets
  id PK
  kind          text   -- image | image_thumb | playground_image | playground_thumb
                       -- | char_ref_source | char_ref_thumb | char_ref_processed
                       -- | vibe_source | vibe_encoded
  rel_path      text UNIQUE      -- 데이터 루트 기준 상대경로, '/' 구분
  content_type  text
  size_bytes    integer
  width, height integer null
  sha256        text
  encrypted     integer(boolean)
  created_at

groups
  id PK
  parent_id     → groups.id ON DELETE CASCADE  null
  name, created_at, updated_at
  idx (parent_id, name, id)

projects
  id PK
  group_id      → groups.id ON DELETE CASCADE  null
  name
  prompt, negative_prompt   text
  character_prompts         json  CharacterPrompt[]
  variables                 json  PromptVariable
  parameters                json  Parameters
  settings                  json  ProjectSettings
  created_at, updated_at
  idx (group_id, name, id)

scenes
  id PK
  project_id    → projects.id ON DELETE CASCADE
  name, position, created_at, updated_at
  idx (project_id, position, id)

scene_variations
  id PK
  scene_id      → scenes.id ON DELETE CASCADE
  position
  variables     json
  created_at, updated_at
  idx (scene_id, position, id)

images
  id PK
  scene_id        → scenes.id ON DELETE CASCADE
  position
  asset_id        → assets.id ON DELETE RESTRICT  NOT NULL
  thumb_asset_id  → assets.id ON DELETE RESTRICT  NOT NULL
  seed            integer
  metadata        json      -- 생성 파라미터 스냅샷
  created_at
  idx (scene_id, position, id)
  idx (asset_id), idx (thumb_asset_id)

vibe_transfers
  id PK
  project_id        → projects.id ON DELETE CASCADE
  position
  source_asset_id   → assets.id RESTRICT NOT NULL
  encoded_asset_id  → assets.id SET NULL
  encoded_for_model text null           -- 인코딩 캐시 무효화 키
  encoded_information_extracted real null
  reference_strength real, information_extracted real
  enabled           integer(boolean)
  cache_key text null, cache_created_at integer(ms) null
  created_at, updated_at
  idx (project_id, position, id)

character_references
  id PK
  project_id          → projects.id CASCADE
  position
  source_asset_id     → assets RESTRICT NOT NULL
  thumb_asset_id      → assets SET NULL
  processed_asset_id  → assets SET NULL
  strength, fidelity real, mode text, enabled boolean
  cache_key, cache_created_at
  created_at, updated_at
  idx (project_id, position, id)

jobs                                 -- queue_items + playground_queue_items 통합 (M9)
  id PK
  kind          text  'scene' | 'playground'
  status        text  'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  priority_key  text  -- fractional index; 앞/뒤 삽입 모두 O(1)
  project_id    → projects.id ON DELETE CASCADE  null
  scene_id      → scenes.id ON DELETE CASCADE  null
  variation_id  → scene_variations.id ON DELETE CASCADE  null
  payload       json null       -- playground 전용 스냅샷: {prompt, negativePrompt, parameters}
  total_images  integer null    -- 컴파일 후 기록
  done_images   integer default 0
  error         text null
  error_kind    text null       -- 'config' | 'auth' | 'rate_limit' | 'network' | 'prompt' | 'runtime'
  created_at, started_at null, finished_at null
  idx (status, priority_key, id)
  idx (scene_id), idx (variation_id)
  CHECK (kind = 'scene' AND scene_id IS NOT NULL AND variation_id IS NOT NULL
      OR kind = 'playground' AND payload IS NOT NULL)

playground_images
  id PK
  asset_id, thumb_asset_id → assets RESTRICT NOT NULL
  prompt, negative_prompt, parameters json, seed, metadata json
  created_at
  idx (created_at, id)

playground_state                     -- 싱글턴
  id PK CHECK (id = 1)
  prompt, negative_prompt, parameters json, updated_at

settings                             -- 싱글턴
  id PK CHECK (id = 1)
  global_variables json
  image            json   ImageSettings
  debug            json   DebugSettings
  novelai_mode     text   'live' | 'mock' | 'fail'
  updated_at

secrets                              -- API 응답에 절대 포함하지 않음 (S2)
  key   text PK                      -- 'novelai_api_key'
  value text                         -- 데이터 암호화가 켜져 있으면 AES-GCM으로 저장
  updated_at

stash_items
  id PK, type, name, payload json, created_at, updated_at
  idx (type, name, id)

debug_requests
  id PK, status, method, url, context json, request json,
  response json null, error null, duration_ms null, created_at, completed_at null
  idx (created_at)
```

### 기존 대비 변경 요점

- 경로 문자열 컬럼(`file_path`, `thumbnail_path`, `source_image_path`, `processed_image_path`)을 **전부 삭제**하고 assets 참조만 남긴다. (M5, B1)
- `export.serverPath`를 settings에서 삭제한다(env 전용, `3server-plan.md` §6). (S3)
- API 키는 `secrets`로 분리한다. (S2)
- 큐 테이블을 `jobs` 하나로 통합하고 이력도 보존한다. (M9, D5)
- 씬 작업은 id 참조만 저장한다 → 실행 시점에 최신 프롬프트로 컴파일한다(D4).

## 3. 마이그레이션 초기화 (M1~M3)

1. 다음을 **삭제**한다:
    - `server/src/db/migrations/` 전체(`meta/` 포함)
    - 직접 만든 `migrate.ts`와 `ensureNestedGroupSchema`
    - `server/dist`의 구 SQL 산출물
2. 새 스키마로 `drizzle-kit generate --name init`을 실행해 `0000_init.sql`과 스냅샷/저널을 생성한다.
3. 런타임은 `drizzle-orm/bun-sqlite/migrator`의 `migrate(db, { migrationsFolder })`를 쓴다.
    - 개발: `server/src/db/migrations`
    - 빌드: `build:prod`에서 `dist/migrations`로 복사 (Dockerfile도 함께, `6release-plan.md`)
4. `drizzle.config.ts`의 기본 경로를 `config.ts`의 `DATABASE_URL` 로직과 같게 맞춘다.
5. **구 DB 감지**: `_migration_history` 테이블이 있으면 아래 메시지를 출력하고 종료한다(자동 삭제는 하지 않음).
    > 이전 버전 DB입니다. 새 데이터 폴더를 지정하거나 기존 폴더를 비우세요
6. 규칙: 적용된 마이그레이션 파일은 수정하지 않는다. 스키마를 바꾸면 항상 새로 `generate`한다. CI에서 검사한다(`6release-plan.md`).

## 4. 시간 처리 (M4)

- DB: `timestamp_ms` → drizzle에서 `Date`로 다룬다.
- API: 모든 시간 필드를 `z.iso.datetime()` 형식(`2026-10-08T03:12:45.123Z`)으로 직렬화한다. 엔티티 응답에서 `toIso`로 변환한다.
- 이미지 메타데이터의 `generatedAt`, 아카이브 매니페스트 시간도 같은 형식을 쓴다.
- `nowIso`, `withUpdatedAt`은 삭제한다.

## 5. Pragma

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = <env>;
```

## 완료 기준

- [ ] `db/schema/*` 작성, `drizzle-kit generate` 결과 커밋, `drizzle-kit check` 통과
- [ ] 빈 데이터 폴더에서 서버 시작 → 마이그레이션 적용, 싱글턴 행 생성
- [ ] 구 DB가 있는 폴더에서 시작 → 안내 메시지와 함께 종료
- [ ] 테스트: 모든 엔티티 응답의 시간 필드가 `Z`로 끝남
- [ ] 테스트: 같은 `position` 값 두 개 삽입 가능, 조회 순서가 id로 결정됨
