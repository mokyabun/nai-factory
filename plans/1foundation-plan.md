# 1. 기반

> 대상 문제: T1, T2, T3, T5, T6, C6, B3(스키마 측)
>
> 이 단계에서 서버 골격, 공용 라이브러리, shared 스키마와 API 계약, 테스트 하네스를 만든다. 도메인 로직은 `3server-plan.md`에서 옮긴다.

## 1. 서버 디렉터리 구조

```
server/src/
  index.ts                 # Bun.serve (idleTimeout: 0, maxRequestBodySize)
  app.ts                   # createApp(): 미들웨어, 라우트 마운트, 에러 핸들러
  config.ts                # env 파싱
  logger.ts
  db/
    client.ts              # createDb, pragma, migrate 호출
    schema/                # 테이블별 파일 + index.ts
    columns.ts             # createdAt(), updatedAt(), position()
    migrate.ts             # drizzle migrator 래퍼 + 구 DB 감지
    migrations/            # drizzle-kit generate 결과 (수정 금지)
  lib/
    http.ts                # httpError, requireEntity, contract → hono 어댑터
    time.ts                # toIso()
    order.ts               # fractional indexing (현 services/order.ts)
    paths.ts               # 데이터 루트, 상대 ↔ 절대 경로, 탈출 방지
    storage.ts             # 파일 읽기/쓰기/암호화 (현 data.ts)
    mime.ts                # contentType, 확장자, 매직바이트 검사
    xml.ts                 # escapeXml
  modules/
    projects/   { routes.ts, service.ts, repo.ts }
    groups/  scenes/  images/  assets/  references/
    jobs/  playground/  settings/  stash/  archive/
    sd-studio/  tags/  debug/  realtime/
  integrations/
    novelai/    { client.ts, errors.ts, multipart.ts, encode.ts, mock.ts }
```

규칙:

- `repo.ts`는 DB 함수만 두고 `tx`를 인자로 받는다(트랜잭션 전파).
- bun:sqlite는 동기 드라이버이므로 **트랜잭션 안에서는 `await`를 쓰지 않는다**(`.run()/.get()/.all()`). 파일 I/O와 sharp 처리는 트랜잭션 밖에서 준비한다.
- 모듈 간 import는 `service`만 허용한다(다른 모듈의 `repo`를 직접 쓰지 않는다).
- import 별칭은 `@/` 하나로 통일한다. `server/package.json`의 `#/` imports는 삭제한다.

## 2. `lib/` 공용 모듈 (T2)

| 모듈         | 내용                                                                                          | 대체하는 기존 코드                        |
| ------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `paths.ts`   | `dataRoot`, `toRelPath(abs)`, `resolveInDataRoot(rel)`(realpath 비교, `..`/절대경로/NUL 거부) | `data.ts`의 `resolvePublicDataPath`       |
| `storage.ts` | `writeFile(rel, bytes)`, `readFile(rel)`, `remove(rel)`, AES-GCM 암호화                       | `data.ts`                                 |
| `mime.ts`    | 확장자 ↔ content-type, 매직바이트로 png/jpeg/webp/avif 판별                                   | `contentType` 3곳                         |
| `xml.ts`     | `escapeXml`                                                                                   | 2곳                                       |
| `order.ts`   | `keyAfter`, `keyBetween`, `keysBetween(n)`, `planMove`                                        | `services/order.ts`, `variationOrder` 3곳 |
| `time.ts`    | `toIso(date)`                                                                                 | `nowIso`, `withUpdatedAt` (삭제)          |
| `http.ts`    | `AppError(code, status, message)`, `requireEntity`, contract 라우트 어댑터                    | `utils.ts`                                |

## 3. API 계약 (hc 대신) (T3)

### 3.1 hc를 쓰지 않는 이유

- hc는 서버 라우트 체인 전체에서 `AppType`을 추론한다. 엔드포인트가 60개 이상이고 각각 zod 검증기가 붙으면 tsserver와 `tsc`가 느려진다.
- 이를 피하려면 타입을 `.d.ts`로 미리 빌드하거나 클라이언트를 쪼개야 한다. 그러면 빌드 단계가 늘고 웹이 서버 패키지에 의존하게 된다.
- 이미 `shared`에 zod 스키마가 있으므로, 엔드포인트 계약을 명시적으로 선언하면 추론이 얕고 서버와 웹이 같은 정의를 쓴다.

### 3.2 형태

```ts
// shared/src/contract/define.ts
export type Endpoint<P, Q, B, R> = {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    path: string // '/scenes/:id'
    params?: z.ZodType<P>
    query?: z.ZodType<Q>
    body?: z.ZodType<B>
    bodyType?: 'json' | 'form'
    response: z.ZodType<R>
}
export const endpoint = <P, Q, B, R>(e: Endpoint<P, Q, B, R>) => e

// shared/src/contract/scenes.ts
export const scenes = {
    list: endpoint({
        method: 'GET',
        path: '/scenes',
        query: SceneListQuery,
        response: z.array(SceneSummary),
    }),
    get: endpoint({ method: 'GET', path: '/scenes/:id', params: IdParams, response: Scene }),
    update: endpoint({
        method: 'PATCH',
        path: '/scenes/:id',
        params: IdParams,
        body: ScenePatch,
        response: Scene,
    }),
    move: endpoint({
        method: 'PATCH',
        path: '/scenes/:id/position',
        params: IdParams,
        body: MoveBody,
        response: Scene,
    }),
}
```

- 서버: `route(app, contract.scenes.update, ({ params, body }) => ...)`. 어댑터가 zod 검증기를 연결하고 반환 타입을 `R`로 강제한다. dev/test에서는 응답 스키마로 parse해서 계약 위반을 잡는다.
- 웹: `call(contract.scenes.update, { params: { id }, body })` (`5web-plan.md`).

### 3.3 API 규칙

- 시간은 ISO Z 문자열, ID는 number를 쓴다.
- 순서 이동은 `MoveBody = { beforeId: number | null, afterId: number | null }` 하나로 통일한다.
- 오류 응답은 `{ error: { code, message, details? } }` 형식으로 한다. 500 오류는 메시지를 일반화하고 `requestId`를 포함한다.
- 파일은 `/api/assets/:id`로만 서빙한다(`3server-plan.md` §2).

## 4. shared 스키마 재정리 (B3, C6)

- 디렉터리 구조:
    - `shared/src/schemas/` : 엔티티(응답) 스키마
    - `shared/src/inputs/` : 요청 스키마
    - `shared/src/contract/` : 엔드포인트 계약
- **엔티티 스키마**에서만 `.default()`를 허용한다(DB의 JSON을 읽을 때 정규화 용도).
- **PATCH 스키마**는 별도로 정의하고 모든 필드를 `.optional()`로만 둔다. `Schema.partial()`로 파생하는 것을 **금지**하고, lint 규칙 또는 테스트로 강제한다(PATCH 스키마에 `{}`를 parse했을 때 `{}`가 나오는지 검사).
- 서버는 PATCH를 받으면 `deepMerge(current, patch)` → 전체 스키마로 parse → 저장한다.
- `z.ZodIssueCode.custom` 같은 deprecated API를 v4 방식으로 바꾼다.
- `Parameters` 범위:

```ts
width/height: int, 64의 배수, 64..2048, width*height <= 3_145_728 (모델별 상한은 상수로)
steps: int 1..50
promptGuidance: 0..10, promptGuidanceRescale: 0..1
seed: int 0..4_294_967_295 (0 = 랜덤)
model / sampler / noiseSchedule: enum (기존 유지)
```

- 위치를 바꾸는 필드(`displayOrder` 등)는 PATCH 스키마에서 제거한다. 순서 변경은 `move` 엔드포인트로만 한다.

## 5. 테스트 하네스 (T6)

- `server/test/helpers/app.ts`의 `createTestApp()`: 메모리 DB, `os.tmpdir()` 임시 데이터 루트, NovelAI mock 모드로 동작한다. `afterAll`에서 정리한다.
- `createApp`은 모듈 임포트 시점에 DB를 만들지 않도록 의존성을 주입받는다(`createApp({ db, config })`). 지금은 `db.ts`가 import 시점에 전역 DB를 만들어 테스트 격리가 어렵다.
- NovelAI mock은 응답 시나리오(성공, 429 ×N, 타임아웃, 401)를 주입할 수 있게 한다(`4queue-plan.md` 테스트에 사용).
- `server/test/domains/*.db` 같은 잔여 파일을 삭제한다.

## 6. 패키지/도구 정리 (T5)

- `@tanstack/*`의 `latest`를 실제 버전으로 고정한다.
- `server/bun.lock`, `shared/bun.lock`을 삭제한다(루트 lockfile만 사용).
- `shadcn`을 devDependencies로 옮긴다. `@types/node` 버전을 하나로 통일한다.
- `server/src/types.d.ts` 등 쓰이지 않는 선언을 점검한다.

## 완료 기준

- [ ] 새 디렉터리 골격, `lib/` 모듈 + 단위 테스트(`paths` 탈출 케이스, `order`, `mime`)
- [ ] contract 정의 도구 + 서버 어댑터 + 샘플 엔드포인트 1개(`/healthz`)
- [ ] PATCH 스키마 테스트: `parse({})`가 `{}`를 반환
- [ ] `Parameters` 경계값 테스트(width=100 → 실패)
- [ ] `createTestApp()`으로 격리된 테스트 실행
