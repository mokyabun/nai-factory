# 3. 서버 모듈

> 대상 문제: S1, S2, S3, B1, B2, B3, C3, C4(저장 측), C6, C7, C9, C10, M8, T1
>
> `1foundation-plan.md`의 구조와 `2database-plan.md`의 스키마 위에 도메인 모듈을 다시 작성한다. 큐/실시간은 `4queue-plan.md`에서 다룬다.

## 1. 모듈 이전 순서

1. `assets` (저장, 서빙, GC) — 다른 모듈이 모두 의존한다
2. `groups` → `projects` → `scenes`(+variations) → `images`
3. `references` (vibe transfer, character reference)
4. `settings` + `secrets`
5. `playground` (상태, 이미지 목록)
6. `stash`, `sd-studio`, `archive`
7. `tags`, `debug`

각 모듈은 `routes.ts`(contract 어댑터만), `service.ts`(로직·트랜잭션), `repo.ts`(쿼리)로 구성한다. (T1)

## 2. assets와 파일 서빙 (S1, B1, C9)

### 저장

```
assets.prepare(bytes, { kind, relPath, transform? })
  → sharp 처리, sha256, 크기, 해상도를 메모리에서 계산 (다시 읽지 않음, C9)
  → storage.writeFile(relPath, encoded)
  → PreparedAsset { relPath, contentType, size, width, height, sha256, encrypted }
assets.insert(tx, prepared) → asset row
assets.discard(prepared)    → 트랜잭션 실패 시 파일 삭제
```

- 파일을 먼저 준비하고 DB 행은 트랜잭션 안에서 한 번에 INSERT한다. 미완성 행이 생기지 않는다. (C4)
- 경로 규칙(상대경로):
    - `images/{projectId}/{sceneId}/{uuid}.{ext}`
    - `thumbs/...`
    - `playground/...`
    - `refs/vibe/...`
    - `refs/char/...`
    - 파일명에 DB id 대신 uuid를 써서 INSERT 전에 경로를 정할 수 있게 한다.

### 서빙

- `GET /api/assets/:id`: id → `rel_path` → `paths.resolveInDataRoot()` → 복호화 → 응답.
    - 헤더: `ETag: "<sha256>"`, `Cache-Control: private, max-age=31536000, immutable`
    - `If-None-Match`가 일치하면 304
- `/data/*` 라우트는 **삭제**한다. (S1)
- 웹은 asset id로만 URL을 만든다. 데이터 루트가 절대경로든 상대경로든 상관없다. (B1)

### 업로드

- `Bun.serve({ maxRequestBodySize })`: 기본 512MB, env `NAI_FACTORY_MAX_UPLOAD_MB`로 조정.
- 이미지 업로드는 매직바이트로 형식을 검증하고 sharp `limitInputPixels`를 설정한다.

## 3. 트랜잭션·삭제·GC (C3, M8)

### 공통 삭제 흐름

```
tx {
  대상과 하위 엔티티의 asset id 수집
  엔티티 삭제 (FK CASCADE)
  assets 행 삭제
}
커밋 후 → storage.remove(각 rel_path)   // 실패하면 로그만 남김
```

- 파일을 DB보다 먼저 지우지 않는다(현재 프로젝트/씬/그룹 삭제가 그렇게 동작함).

### GC

- 서버 시작 시와 하루 1회 실행한다.
    - 어떤 테이블도 참조하지 않는 `assets` 행 → 삭제
    - 데이터 루트에서 `assets.rel_path`에 없는 파일 → 삭제(최근 10분 내 생성 파일은 제외)
- `GET /api/debug/gc`(dry-run)로 결과를 확인할 수 있게 한다.

### 트랜잭션으로 묶을 작업

- 프로젝트 복제(씬, 변수, 레퍼런스 포함 여부는 옵션)
- 씬 JSON 가져오기(append/replace)
- stash 적용(append/replace)
- SD Studio 가져오기
- 아카이브 가져오기의 DB 부분(파일은 미리 준비하고, 실패하면 discard)
- 그룹 이동(순환 검사 포함)
- 변수 sync (아래 §4)

## 4. 씬과 변수 (B2)

- `PATCH /scenes/:id`의 `variations`는 전체 목록이다. 트랜잭션 안에서 다음 순서로 처리한다.
    1. 목록에서 빠진 id → 삭제(CASCADE로 해당 queued job도 삭제)
    2. 기존 id → `variables` 업데이트
    3. id가 없는 항목 → insert
    4. 결과 순서대로 `position = keysBetween(null, null, n)` 일괄 재부여
- UNIQUE 제약이 없으므로 순서를 바꾸거나 중간에 끼워 넣어도 충돌하지 않는다.
- 씬, 이미지, 레퍼런스의 순서 이동은 `PATCH /…/:id/position { beforeId, afterId }`로 통일한다. 키 길이가 임계값을 넘으면 같은 트랜잭션에서 형제 전체를 재부여한다.

## 5. 설정과 비밀값 (B3, S2)

- 설정 섹션: `prompt.globalVariables`, `image`, `debug`, `novelai.mode`.
- `GET /settings` → `SettingsView`:

```ts
{
  globalVariables, image, debug,
  novelai: { mode, hasApiKey: boolean, keyHint: string | null /* '****abcd' */ },
  export: { serverExportEnabled: boolean }   // env 설정 여부만 노출
}
```

- `PATCH /settings`: 기본값 없는 DeepPartial을 받는다 → `deepMerge(current, patch)` → `GlobalSettings.parse` → 저장 → 캐시 교체.
- `PUT /settings/novelai-key { apiKey }`: 키를 검증(`/user/subscription`, 타임아웃 10초)한 뒤 `secrets`에 저장한다. `DELETE`는 삭제한다.
- 프로젝트 `settings` PATCH도 같은 병합 방식을 쓴다(B3 재현 케이스를 테스트로 고정).

## 6. 보안 — 토큰 없이 (D3)

토큰이 없어도 다음 조합으로 브라우저 기반 공격(다른 사이트에서 localhost 호출, DNS rebinding, CSRF)을 막는다.

| 항목               | 설계                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 바인딩             | 개발 기본 `HOST=127.0.0.1`. Docker 컨테이너 안에서는 `0.0.0.0`을 쓰고, compose 예시의 포트는 `127.0.0.1:3000:3000`으로 둔다(LAN 공개는 사용자가 직접 변경)                   |
| CORS               | 운영에서는 **미들웨어 없음**(같은 출처만). 개발에서는 `http://localhost:5173`만 허용                                                                                         |
| Host 검사          | `Host` 헤더 허용 목록: `localhost`, `127.0.0.1`, `[::1]`, **모든 IP 리터럴**(LAN IP 접속 허용), env `NAI_FACTORY_ALLOWED_HOSTS`. 그 외 도메인 이름은 403(DNS rebinding 차단) |
| Origin 검사        | 상태를 바꾸는 요청(POST/PATCH/PUT/DELETE)은 `Origin`이 없거나 요청 Host와 같을 때만 허용. `Sec-Fetch-Site: cross-site`이면 거부(CSRF 차단)                                   |
| SSE/asset GET      | 같은 Host 검사 적용                                                                                                                                                          |
| 비밀값             | API 키는 응답에 절대 포함하지 않음(§5). 디버그 요청 로그에서도 Authorization 헤더 제거                                                                                       |
| 서버 경로 내보내기 | env `NAI_FACTORY_EXPORT_DIR`가 있을 때만 허용. 요청에서는 하위 폴더 이름만 받고 `^[\w\- .]+$`로 검증(`..` 금지). 실제 경로는 `resolveInside(exportDir, name)` (S3)           |
| 선택 토큰          | `NAI_FACTORY_ACCESS_TOKEN`이 설정된 경우에만 Bearer 또는 HttpOnly 쿠키를 요구. 미설정이 기본값                                                                               |
| 경고 로그          | `HOST`가 루프백이 아니고 토큰도 없으면 시작 시 warn 로그 1회                                                                                                                 |

## 7. 아카이브/내보내기 (C7, C10)

- `.naif` 포맷은 버전 3으로 새로 정의하고, **이전 버전은 지원하지 않는다**(배포 전이므로).
    - 매니페스트의 시간은 ISO Z, asset은 `{ id, kind, path, sha256, size }` 형식으로 한다.
- 스트리밍: fflate의 `Zip`/`Unzip` 스트림 API를 쓴다.
    - 내보내기: `ReadableStream` 응답
    - 가져오기: 엔트리 단위로 처리한다. 엔트리 수(10만)와 총 해제 크기(env, 기본 4GB) 상한으로 zip bomb을 막는다.
    - 경로: 엔트리 이름에 `..`나 절대경로가 있으면 거부한다.
- 이미지 내보내기 파일명: `used` 집합에 **최종 결과 이름**을 등록하고, 충돌이 없을 때까지 `-n`을 증가시킨다. (C10)
- 템플릿 변수(`{character}`, `{scene}`, `{number}`, `{extension}`)는 유지한다.

## 8. 기타 모듈

- **SD Studio 가져오기**: 파서(`parseSdStudioFile`)와 기존 테스트를 유지하고, 저장 부분만 트랜잭션으로 바꾼다.
- **stash**: payload를 엔티티 스키마로 검증하고, 적용은 트랜잭션으로 한다.
- **tags**: 기존 FlexSearch 인덱스를 유지한다. 빌드 스크립트 경로만 정리한다.
- **debug**: `debug_requests`의 보관 개수 상한을 유지하고, 요청 헤더를 기록하지 않는다.

## 회귀 테스트

| ID  | 테스트                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | `/api/assets/abc`, `/api/assets/..%2F..` → 404. `/api/data/*` 라우트 없음                                                                      |
| S2  | `GET /settings` 응답에 apiKey 원문 없음. 다른 Origin의 PATCH → 403. 낯선 Host 헤더 → 403                                                       |
| S3  | `NAI_FACTORY_EXPORT_DIR` 미설정 시 서버 내보내기 400. 하위 폴더 `../x` → 400                                                                   |
| B1  | 절대경로 데이터 루트로 이미지 저장(mock) → `/api/assets/:id` 200                                                                               |
| B2  | 변수 [A,B] → [B,A], [A,new,B] → 200, 순서 일치                                                                                                 |
| B3  | 프로젝트 `{slideshowImageCount:8}` 저장 후 `{outputTemplate}`만 PATCH → 8 유지. 전역 설정 `novelai.mode='mock'` 후 다른 섹션 PATCH → mock 유지 |
| C3  | 씬 JSON replace 도중 강제 예외 → 기존 씬과 이미지 유지                                                                                         |
| C10 | 같은 템플릿 결과 3개 + 기존 `a-2.png` → 모두 고유                                                                                              |
| GC  | 참조되지 않는 asset 행과 파일이 삭제되고, 참조 중인 것은 유지                                                                                  |
