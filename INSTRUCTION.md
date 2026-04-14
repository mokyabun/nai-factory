# NAI Factory — Project Instruction

## 프로젝트 개요

NAI Factory는 **NovelAI 이미지 생성 API를 위한 로컬 배치 자동화 시스템**이다.
사용자가 프롬프트 템플릿을 정의하고 변수 조합(variations)을 설정하면, 큐에 등록된 모든 씬을 순차적으로 NovelAI API에 요청하여 이미지를 로컬에 저장한다.

모노레포 구조로 세 가지 워크스페이스로 구성된다:
- `server/` — Bun + Elysia 백엔드 API 서버
- `shared/` — 서버/클라이언트 공용 타입 및 스키마 (`@nai-factory/shared`)
- `web/` — SvelteKit 프론트엔드

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 런타임 | Bun |
| HTTP 프레임워크 | Elysia v1.4 |
| 데이터베이스 | SQLite (Drizzle ORM, WAL 모드) |
| 이미지 처리 | sharp |
| HTTP 클라이언트 | ky (재시도/백오프 포함) |
| 템플릿 엔진 | Handlebars |
| ZIP 압축 해제 | fflate |
| 로깅 | pino + pino-pretty |
| 정렬 | fractional-indexing-jittered |
| 프론트엔드 | SvelteKit |

---

## 도메인 모델

### 계층 구조

```
Group
  └── Project (프롬프트 템플릿 + 기본 파라미터 + 캐릭터 프롬프트 + 바이브 트랜스퍼)
        └── Scene (variations 배열 보유 — 각 variation = 이미지 1장)
              └── Image (생성된 이미지 파일 + 메타데이터)
```

### 변수 우선순위 (낮음 → 높음)

```
globalVariables (Settings) < project.variables < scene.variations[i]
```

### 핵심 엔티티 설명

- **Group**: 프로젝트 묶음 (이름만 있음)
- **Project**: 이미지 생성의 기본 설정 단위. Handlebars 프롬프트 템플릿, 생성 파라미터 (모델, 해상도, 샘플러 등), 기본 변수, 캐릭터 프롬프트, 바이브 트랜스퍼 목록을 보유
- **Scene**: 프로젝트 내 개별 씬. `variations` 배열의 각 항목이 변수 세트이며, 변수 세트 수만큼 이미지가 생성됨. `displayOrder`로 드래그 정렬 지원
- **Image**: 생성된 이미지. 원본(full-res) + 썸네일 경로, 생성 시 사용한 파라미터를 `metadata`로 저장
- **QueueItem**: 대기 중인 생성 작업. `variationCount`로 남은 변수 수 추적, `sortIndex`로 우선순위 결정
- **Settings**: 전역 변수, NovelAI API 키, 이미지 저장 형식을 보관하는 단일 행 테이블

---

## 프롬프트 시스템

### Handlebars 템플릿 + 변수 병합

프로젝트의 프롬프트는 Handlebars 템플릿이다:
```
"a {{subject}} wearing {{outfit}} in a garden, {{quality_tags}}"
```

씬의 `variations` 배열에 변수 세트를 정의하면:
```json
[
  { "subject": "cat", "outfit": "kimono" },
  { "subject": "dog", "outfit": "suit" }
]
```

큐 실행 시 NovelAI API를 1번 호출해 이미지를 1장 생성한다.

### 캐릭터 프롬프트

NovelAI v4 모델의 멀티 캐릭터 기능을 지원한다. 각 캐릭터마다 독립된 프롬프트/UC와 화면 내 위치(center)를 지정할 수 있다.

### 프롬프트 미리보기

`GET /scenes/:id/preview-prompt?variationId=` 엔드포인트를 통해, 실제 생성 전에 특정 variation에 대한 컴파일된 프롬프트를 확인할 수 있다.

---

## 바이브 트랜스퍼 (Vibe Transfer)

NovelAI의 바이브 트랜스퍼 기능을 지원한다.

- 레퍼런스 이미지를 업로드하면 NAI API에서 인코딩 (`encode-vibe`)하여 `encodedData` (~80KB base64)로 저장
- 각 레퍼런스에 `referenceStrength` (기본 0.6), `informationExtracted` (기본 1.0) 설정 가능
- 프로젝트에 여러 개의 바이브 트랜스퍼를 등록하고 순서 조정 가능
- 현재 미완성: 큐 실행(`queue-runner.ts`)에서 실제 생성 요청 시 바이브 데이터가 아직 연결되지 않음 (`reference_image_multiple: []` 하드코딩)

---

## 큐 시스템

### 큐 아이템 생성

- `POST /queue/enqueue`: 단일 씬을 큐에 등록
- `POST /queue/enqueue-all`: 프로젝트의 모든 씬을 큐에 일괄 등록
- 등록 시 `position` 파라미터로 큐의 앞/뒤에 삽입 선택 (`sortIndex` = `-Date.now()` / `+Date.now()`)

### 큐 실행 (`QueueManager` + `runJob`)

1. `POST /queue/start`로 큐 프로세서 시작
2. `QueueManager`가 `sortIndex ASC` 순서로 작업을 순차 처리
3. `runJob` 제너레이터가 각 작업을 처리:
   - 전역 설정, 프로젝트, 씬 데이터 로드
   - 변수 병합 및 Handlebars 컴파일
   - NovelAI API 호출 (variation 수만큼 반복)
   - 응답 ZIP 해제 → 이미지 파일 저장 + DB 기록
   - `variationCount` 감소, 완료 시 QueueItem 삭제
4. `POST /queue/stop`으로 현재 작업 완료 후 중단
5. 큐 상태(`GET /queue/status`)에서 진행 여부, 대기 작업 수, 완료 예상 시간(ETA) 확인 가능 (최근 20개 처리 시간 기반 rolling average)

---

## 이미지 파일 저장

```
./data/images/{projectId}/{sceneId}/{imageId}.{ext}      # 원본 이미지
./data/thumbnails/{projectId}/{sceneId}/{imageId}.{ext}  # 썸네일
./data/vibes/{projectId}/{timestamp}.{ext}               # 바이브 트랜스퍼 레퍼런스 이미지
```

지원 포맷: `png` (무손실), `webp` (quality 1-100), `avif` (quality 1-100)
썸네일: `thumbnailSize` px 최대 크기로 리사이즈 (Settings에서 설정)

---

## NovelAI API 연동

| 엔드포인트 | 용도 |
|---|---|
| `POST image.novelai.net/ai/generate-image` | 이미지 생성 (ZIP 응답) |
| `POST image.novelai.net/ai/encode-vibe` | 바이브 트랜스퍼 인코딩 |
| `GET api.novelai.net/user/subscription` | API 키 유효성 검증 |

**지원 모델**: `nai-diffusion-4-5-full`, `nai-diffusion-4-5-curated`, `nai-diffusion-4-full`, `nai-diffusion-4-curated`

**지원 샘플러**: `k_euler_ancestral`, `k_euler`, `k_dpmpp_2s_ancestral`, `k_dpmpp_2m`, `k_dpmpp_sde`, `k_dpmpp_2m_sde`, `dimm_v3`

**재시도**: 최대 5회, 지수 백오프 (시작 1초), 요청 타임아웃 120초

---

## SD Studio 임포트

`services/sd-studio-import.ts`는 SD Studio JSON 프리셋 파일을 파싱하여 NAI Factory 씬 형식으로 변환한다.

- 슬롯 대안들의 **카르테지안 곱(Cartesian product)**으로 씬 variation 자동 생성
- `<library.piece>` 레퍼런스 해석
- 중복 씬 이름에 `(N)` 접미사 처리

- 다른 코드에서 가져온거라, 다시 짜거나 나의 코드에 붙여야함

---

## API 엔드포인트 목록

모든 엔드포인트는 `/api` 접두사를 사용한다.

### Groups
- `GET /groups` — 전체 목록
- `GET /groups/:id` — 상세 + 하위 프로젝트
- `POST /groups` — 생성
- `PATCH /groups/:id` — 이름 수정
- `DELETE /groups/:id` — 삭제 (cascade)

### Projects
- `POST /projects` — 생성
- `PATCH /projects/:id` — 수정
- `DELETE /projects/:id` — 삭제 (cascade)

### Vibe Transfers
- `GET /projects/:projectId/vibe-transfers` — 목록
- `POST /projects/:projectId/vibe-transfers/upload` — 레퍼런스 이미지 업로드
- `PATCH /projects/:projectId/vibe-transfers/reorder` — 순서 변경
- `PATCH /projects/:projectId/vibe-transfers/:index` — strength/information 수정
- `DELETE /projects/:projectId/vibe-transfers/:index` — 삭제

### Scenes
- `GET /scenes?projectId=` — 프로젝트별 씬 목록
- `GET /scenes/:id` — 씬 상세 + 이미지 목록
- `GET /scenes/:id/workspace` — 씬 편집에 필요한 프로젝트 전체 데이터
- `GET /scenes/:id/preview-prompt?variationId=` — 컴파일된 프롬프트 미리보기
- `POST /scenes` — 생성
- `PATCH /scenes/:id` — 이름/변수 수정
- `PATCH /scenes/:id/order` — 순서 변경 (fractional indexing)
- `DELETE /scenes/:id` — 삭제

### Images
- `GET /images?sceneId=` — 씬별 이미지 목록
- `DELETE /images/:id` — 삭제 (파일 포함)

### Queue
- `GET /queue?projectId=` — 큐 아이템 목록
- `GET /queue/status` — 큐 상태 + ETA
- `POST /queue/enqueue` — 씬 큐 등록
- `POST /queue/enqueue-all` — 프로젝트 전체 씬 등록
- `POST /queue/start` — 큐 시작
- `POST /queue/stop` — 큐 중지
- `DELETE /queue/:id` — 큐 아이템 취소

### Settings
- `GET /settings` — 전역 설정 조회
- `PATCH /settings` — 설정 수정
- `DELETE /settings` — 초기화

---

## 디렉토리 구조

```
server/src/
  index.ts                  # 앱 진입점, 모든 도메인 /api 하위에 마운트
  logger.ts                 # Pino 싱글톤
  db/
    index.ts                # SQLite 설정 (WAL, FK, 캐시), 마이그레이션 실행
    schema.ts               # Drizzle 테이블 정의
    migrate.ts              # SQL 파일 기반 마이그레이션 러너
    migrations/             # SQL 마이그레이션 파일
  domain/                   # Elysia 플러그인 (라우트 핸들러)
    group/                  # index.ts (라우트) + service.ts (DB 쿼리)
    project/                # service.ts (DB 쿼리)
    image/                  # index.ts (라우트) + service.ts (DB + 파일 삭제)
    scene.ts                # 라우트 + 인라인 서비스
    queue.ts                # 라우트 + 인라인 서비스
    vibe-transfer.ts        # 라우트 + 인라인 서비스
    settings.ts             # 라우트
  services/
    novelai.ts              # NovelAI API 클라이언트
    prompt.ts               # Handlebars 템플릿 컴파일러
    image.ts                # 이미지 파일 I/O
    settings.ts             # 인메모리 캐시 기반 설정 싱글톤
    queue-manager.ts        # QueueManager 싱글톤 (큐 제어)
    queue-runner.ts         # runJob 제너레이터 (실제 생성 로직)
    sd-studio-import.ts     # SD Studio JSON 임포터

shared/src/
  app.ts                    # 공용 TypeBox 스키마 (Parameters, CharacterPrompt 등)
  novelai.ts                # NovelAI 타입 정의
  settings.ts               # Settings TypeBox 스키마
  domain.ts                 # HTTP 요청/응답 Elysia 스키마
```

---

## 남은 작업

### 1. 런타임 크래시 (서버 기동 불가)

- **`domain/character-prompts.ts` 누락**: `index.ts`에서 `import { characterPrompt } from './domain/character-prompts'`하지만 해당 파일이 없어 서버 시작 시 즉시 크래시
- **`@/types` 삭제 후 미반영**: `server/src/types/` 디렉토리 삭제됐지만 `domain/vibe-transfer.ts`가 여전히 `import type { VibeTransfer } from '@/types'` 사용 → `@nai-factory/shared`로 수정 필요
- **export 이름 불일치**: `index.ts`는 `{ image }`, `{ group }`으로 import하지만 실제 도메인 파일은 `imageController`, `groupController`를 export함
- **`domain/vibe-transfer.ts` 전체 stale**: 파일 전체가 `proj.vibeTransfers` JSON 컬럼을 읽는 방식으로 돼 있으나, 현재 스키마에는 해당 컬럼이 없고 별도 `vibeTransfers` 테이블로 분리됨. 파일 전체를 `server-next/src/services/vibe-transfer.ts` 기반으로 재작성 필요

### 2. 엔드포인트 레벨 오류 (특정 라우트 동작 불가)

- **`domain/queue.ts` — QueueManager 메서드명 전부 stale**: 큐 매니저 리팩토링 후 `domain/queue.ts`에 반영 안 됨. 5곳 모두 잘못된 이름 호출:
  - `queueManager.enqueue(sceneId, null, position)` → `add(sceneId, position)`
  - `queueManager.cancelJobs([id])` → `cancel(jobIds)`
  - `queueManager.getQueueStatus()` → `status()`
  - `queueManager.startQueue()` → `start()`
  - `queueManager.stopQueue()` → `stop()`
- **`domain/queue.ts` — 존재하지 않는 컬럼 참조**: `.orderBy(desc(queueItems.priority), asc(queueItems.createdAt))` 사용하지만 `queueItems`에는 `priority`, `createdAt` 컬럼이 없음. 올바른 정렬 컬럼은 `asc(queueItems.sortIndex)`
- **`@/modules/project` 없음**: `domain/scene.ts`가 `import { getWorkspaceData } from '@/modules/project'` → `modules/` 디렉토리 자체가 없어 `GET /scenes/:id/workspace` 동작 불가
- **`promptService.synthesizePrompts` 없음**: `domain/scene.ts`에서 `promptService.synthesizePrompts(id, variationId)` 호출하지만 `services/prompt.ts`에는 해당 API가 없음 → `GET /scenes/:id/preview-prompt` 동작 불가

### 3. 빈 파일 / 미구현

- **`domain/project/index.ts`**: 비어있음. `service.ts`(`getById`, `getAllByGroupId`, `create`, `update`, `remove`)는 완성돼 있으므로 라우트 컨트롤러만 작성하면 됨
  - `GET /projects?groupId=`, `GET /projects/:id`, `POST /projects`, `PATCH /projects/:id`, `DELETE /projects/:id`
- **`services/vibe-image.ts`**: 비어있음. `server-next/src/services/vibe-image.ts`를 참고하여 구현:
  - `checkVibe(vibeTransferId, apiKey, model)` — DB에서 vibe 로드, `encodedData` 없거나 `informationExtracted` 변경 시 소스 이미지 읽어서 `novelai.encodeVibe()` 호출 후 DB 저장
  - `checkVibesForProject(projectId, apiKey, model)` — 프로젝트의 모든 vibe를 `checkVibe()` 처리 후 `NovelAIVibeImage[]` 반환 → `generateImage()` 파라미터에 직접 주입
  - `invalidateVibe(vibeTransferId)` — `informationExtracted` 변경 시 `encodedData`를 null로 초기화 (재인코딩 트리거)
- **`shared/src/schema.ts`**: `import { t } from 'elysia'`만 있고 export 없는 빈 파일. `shared/src/index.ts`에도 포함되지 않은 고아 파일 — 삭제 또는 내용 채우기 필요

### 4. 기능 미연결

- **바이브 트랜스퍼 → 큐 실행 연결 안 됨**:
  - `services/queue-runner.ts`: `vibeTransfers: []` 하드코딩 (TODO 주석 있음)
  - `services/novelai.ts`: `reference_image_multiple: []`, `reference_strength_multiple: []` 하드코딩 (TODO 주석 있음)
  - `services/vibe-image.ts` 구현 → `queue-runner.ts`에서 프로젝트의 vibe 데이터 로드 → 생성 파라미터에 주입하는 흐름 완성 필요
- **`domain/character-prompts` 도메인 전체 누락**: 캐릭터 프롬프트 CRUD 라우트 + 서비스가 없음. `server-next/src/routes/character-prompts.ts`, `server-next/src/services/character-prompt.ts` 참고
- **비활성화 캐릭터 프롬프트 필터링 누락**: `services/novelai.ts`에서 `params.characterPrompts`를 `enabled` 플래그 확인 없이 전부 API에 전송. 비활성화된 캐릭터도 실제 생성에 포함됨
- **`variationId` 파라미터 미구현**: `domain/queue.ts` `enqueueBody`에 `variationId` 필드가 있지만 `QueueManager.add()`는 해당 파라미터를 받지 않고, `queueItems` 테이블에도 컬럼이 없음. 특정 variation만 재생성하는 기능이 의도됐으나 전혀 동작하지 않음

### 5. 아키텍처 리팩토링 (인라인 서비스 → 분리)

`domain/group/`, `domain/image/`는 `index.ts`(라우트) + `service.ts`(DB 쿼리)로 분리 완료.
아래 세 도메인은 서비스 로직이 라우트 파일에 인라인으로 혼재:

- `domain/scene.ts` → `domain/scene/index.ts` + `domain/scene/service.ts`
- `domain/queue.ts` → `domain/queue/index.ts` + `domain/queue/service.ts`
- `domain/vibe-transfer.ts` → `domain/vibe-transfer/index.ts` + `domain/vibe-transfer/service.ts`

### 6. 버그

- **`services/image.ts` `remove()` 확장자 하드코딩**: 삭제 시 경로를 `.png` / `.webp`로 고정. 하지만 `save()`는 Settings의 `sourceType.type`, `thumbnailType.type`을 동적으로 사용하므로, 다른 포맷으로 저장된 경우 파일이 삭제되지 않고 남음 (`force: true`라 에러도 발생하지 않음)
- **`domain/scene.ts` `update()` 잘못된 컬럼명**: `SceneModel.updateBody`에 `variables`, `prompts`, `negativePrompts` 필드 정의, DB 업데이트 시 `{ variables: JSON.stringify(variables) }` 사용 — 실제 `scenes` 테이블에는 해당 컬럼이 없고 `variations` 컬럼임. 씬 업데이트가 항상 silently 실패
- **`domain/group/index.ts` 404 → 500**: 그룹 없을 때 `throw new Error('Group not found')` 사용 → 전역 에러 핸들러가 500으로 처리. 다른 도메인들처럼 `throw status(404, ...)` 사용해야 함
- **`db/schema.ts` `vibeTransfers.encodedData` `.notNull()` 제약**: 업로드 직후에는 인코딩 전이므로 `null` 허용 필요. `invalidateVibe()`도 null로 초기화해야 하는데 현재 제약으로 막힘. nullable로 변경 + 마이그레이션 필요
- **`db/schema.ts` `autoIncrement` 제거**: SQLite에서 `INTEGER PRIMARY KEY`는 자동으로 rowid alias가 되므로 `autoIncrement` 불필요. 오히려 불필요한 제약(`AUTOINCREMENT` 키워드)을 추가해 성능 오버헤드 발생. `vibeTransfers`, `scenes`, `queueItems` 등 `.primaryKey({ autoIncrement: true })` 사용 중인 테이블 모두 `.primaryKey()`로 변경
- **`services/queue-runner.ts` `variationCount` 잘못된 감소**: `job`은 함수 시작 시 한 번만 로드되고 갱신되지 않음. variation 루프 전 과정에서 항상 `initial_count - 1`을 기록 → ETA 계산 부정확

### 7. SD Studio 임포터

- `services/sd-studio-import.ts` 구현 자체는 완성돼 있지만 API 라우트가 없어 미노출
- 코드가 외부 프로젝트에서 가져온 것이므로, 재작성 또는 현재 구현을 `domain/`에 라우트로 노출하는 방향 중 결정 필요
