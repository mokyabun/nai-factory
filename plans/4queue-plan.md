# 4. 큐, NovelAI, 실시간

> 대상 문제: C1, C2, C4(실행 측), C5, C8, B4, B5, D4, D5

## 1. 프롬프트 반영 방식 (D4)

- **씬 작업**: `jobs`에는 `project_id`/`scene_id`/`variation_id`만 저장한다. 실행 시점(및 이미지 한 장마다)에 최신 프롬프트·변수·파라미터를 읽어 컴파일한다.
    - 큐에 넣은 뒤 프롬프트, 변수, 파라미터, 레퍼런스를 고치면 **아직 생성하지 않은 이미지에 반영된다**.
    - 현재 코드도 실행 시점에 DB에서 읽기 때문에 이미 반영되고 있다. 새 설계에서도 이 동작을 유지하고, 회귀 테스트로 고정한다.
- **플레이그라운드 작업**: 넣는 시점의 prompt/parameters를 `payload`에 스냅샷으로 저장한다(플레이그라운드 편집기는 계속 바뀌는 초안이기 때문).

## 2. 스케줄러 (C5)

- 단일 워커 루프(`modules/jobs/scheduler.ts`). 상태는 다음과 같다.
    - `running: boolean`
    - `pauseReason: 'user' | 'failure' | null`
    - `current: { jobId, abort: AbortController } | null`
- `wake()`: enqueue/start/retry에서 호출한다. 루프가 돌고 있으면 아무것도 하지 않고, 아니면 루프를 시작한다.
- 루프 종료 조건 확인과 `processing=false` 설정을 같은 동기 구간에서 처리한다. 다음 작업 조회가 동기 SQLite이므로 `await` 없이 "조회 → 없으면 종료"를 할 수 있다. (C5)
- 서버를 시작할 때 `status='running'`으로 남은 작업은 `queued`로 되돌린다(크래시 복구, `done_images` 유지).
- 큐 상태(`idle | running | pausing | paused`)는 기존 정의를 유지한다.

## 3. 작업 실행 (C1, C2, C4)

```
runSceneJob(job, signal):
  loop:
    ctx = 최신 project/scene/variation/settings 로드      # D4
      → 행이 없으면 job 'cancelled' (씬/변수가 삭제됨, 실패로 보지 않음)
    prompts = compile(ctx)
    UPDATE jobs SET total_images = prompts.length
    i = job.done_images
    if i >= prompts.length: break
    signal.throwIfAborted()
    params = buildParams(ctx, prompts[i])                # 레퍼런스 캐시 포함
    bytes = await novelai.generate(params, { signal })
    prepared = await assets.prepareImage(bytes, settings.image)   # 트랜잭션 밖
    tx:
      assets INSERT ×2
      images INSERT (position = 씬 맨 앞)
      jobs.done_images = i + 1
    (tx 실패 → prepared.discard())
    publish(job.progress, scene.images.changed)
  jobs.status = 'completed', finished_at
```

- **C1**: `done_images`부터 이어서 생성한다. 이미지 한 장마다 다시 컴파일하므로, 도중에 변수 개수가 바뀌면 `total_images`도 갱신된다.
- **C2**:
    - `DELETE /jobs/:id`가 실행 중인 작업이면 `abort()` → NovelAI 요청을 중단하고 `cancelled`로 바꾼다.
    - 씬/변수를 삭제하면 FK CASCADE로 job 행이 사라진다. 실행기는 다음 단계에서 이를 감지해 조용히 종료한다(큐를 정지하지 않음).
- **C4**: 파일을 먼저 준비하고 DB 행은 한 번에 넣는다.
- **실패**: `status='failed'`, `error`/`error_kind`를 기록하고 큐를 일시정지한다(`pauseReason='failure'`).
- **재시도**: `POST /jobs/:id/retry` → `queued`로 되돌린다(`done_images` 유지).
- 레퍼런스 캐시 업로드 표시(`markUploadedReferenceCaches`)는 이미지 트랜잭션과 함께 커밋한다.
- seed: 프로젝트 seed가 0이면 이미지마다 랜덤으로 정하고, 실제 값을 `images.seed`에 저장한다.

## 4. 작업 API

| 엔드포인트                            | 설명                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /jobs?status=queued,running`     | 대기 목록 (scene/playground 통합)                                                               |
| `GET /jobs/history?limit=`            | 완료/실패/취소 이력 (D5)                                                                        |
| `GET /jobs/status`                    | 상태 요약 (state, pauseReason, current, 예상 시간, 통계)                                        |
| `POST /jobs/scene`                    | `{ sceneIds?, variationIds?, projectId?, position: 'front' \| 'back' }` (enqueue/bulk/all 통합) |
| `POST /jobs/playground`               | 현재 플레이그라운드 상태를 스냅샷으로 넣기                                                      |
| `POST /jobs/start`, `POST /jobs/stop` | 시작/정지 (정지는 현재 이미지 완료 후)                                                          |
| `PATCH /jobs/:id/position`            | 대기 순서 변경                                                                                  |
| `POST /jobs/:id/retry`                | 실패 작업 재시도                                                                                |
| `DELETE /jobs/:id`                    | 대기 작업 삭제 또는 실행 중 작업 취소                                                           |
| `DELETE /jobs?sceneId=&variationId=`  | 조건 일괄 삭제                                                                                  |

- 이력 정리: 완료/취소된 작업은 최근 200개만 남긴다(작업이 끝날 때마다 정리).
- 평균 소요 시간 통계는 `jobs`에서 계산하거나 메모리 롤링 샘플을 유지한다(재시작 시 초기화되어도 무방).

## 5. NovelAI 클라이언트 (B5, C8)

- 위치: `integrations/novelai/`.
- 오류 타입:

```ts
class NovelAIError extends Error {
    status: number | null
    kind: 'auth' | 'rate_limit' | 'server' | 'bad_request' | 'timeout' | 'network' | 'aborted'
    retryable: boolean
    body?: string
}
```

메시지 정규식으로 분류하던 `failureCategory`는 삭제한다. (C8)

- 재시도 정책(B5):
    - `429`, `502`, `503`, `504` → 지수 백오프, 최대 4회. `Retry-After` 헤더를 우선한다. ky 옵션에 `methods: ['post']`를 명시한다.
    - **타임아웃과 네트워크 단절은 자동 재시도하지 않는다**(이미 과금됐을 수 있음). 작업을 실패로 처리하고 사용자가 재시도한다.
    - `401`/`403` → `auth`로 즉시 실패.
- 모든 요청에 `timeout`과 `signal`을 전달한다(`/user/data`, `/user/subscription` 포함, 기본 10초).
- Anlas 상태는 서버에서 30초 캐시한다. 이미지 생성 후에는 캐시를 무효화한다.
- multipart 생성, vibe 인코딩, mock 이미지 생성은 각각 파일로 분리한다.
- V5 모델 제약(Variety+/Vibe/Character Reference 미지원)은 `buildParams`에서 한 곳으로 모아 처리한다.

## 6. 실시간(SSE) (B4)

- `Bun.serve({ idleTimeout: 0 })`로 설정하고 하트비트는 15초로 한다(프록시 환경 대비).
- 이벤트(shared `RealtimeEvent`):

| 이벤트                      | 페이로드                                 | 용도                                        |
| --------------------------- | ---------------------------------------- | ------------------------------------------- |
| `job.progress`              | `{ jobId, done, total, imageStartedAt }` | 진행 표시 (상태 재조회 없이 캐시 직접 갱신) |
| `jobs.changed`              | `{}`                                     | 목록·상태 무효화                            |
| `scene.images.changed`      | `{ projectId, sceneId }`                 | 이미지 목록                                 |
| `playground.images.changed` | `{}`                                     |                                             |
| `settings.changed`          | `{ sections }`                           | 다른 탭 동기화                              |
| `debug.requests.changed`    | `{}`                                     |                                             |

- 각 이벤트에 단조 증가 `id`를 붙인다. 서버 링버퍼(최근 500개)를 두고, 재연결 시 `Last-Event-ID` 이후 이벤트를 재전송한다. 버퍼 범위를 벗어난 경우에만 `resync` 이벤트를 보내 클라이언트가 전체 무효화하게 한다.
- 같은 이벤트 병합(현재 `publish` 디바운스)은 유지한다.

## 회귀 테스트

| ID   | 테스트                                                                                    |
| ---- | ----------------------------------------------------------------------------------------- |
| D4   | 씬 작업을 넣고, 실행 전에 프롬프트를 수정 → 생성 메타데이터에 수정된 프롬프트             |
| D4   | 3장 작업의 1장째 생성 중 변수 값 수정 → 2·3장에 반영                                      |
| C1   | 3장 작업에서 2번째에 실패(mock) → 재시도 시 2·3번째만 생성, 총 3장                        |
| C2   | 실행 중 취소 → abort 호출, 상태 `cancelled`. 실행 중 씬 삭제 → 큐가 failure로 멈추지 않음 |
| C5   | 루프 종료 직전 enqueue → 작업이 실행됨                                                    |
| B5   | mock이 429를 2번 반환 후 성공 → 이미지 1장. 타임아웃 → 재시도 없이 실패                   |
| B4   | 서버를 띄워 SSE가 15초 이상 유지되고 ping 수신                                            |
| SSE  | `Last-Event-ID`로 재연결 시 놓친 이벤트 수신                                              |
| 복구 | `running` 상태로 남은 작업이 재시작 후 `queued`로 복귀                                    |
