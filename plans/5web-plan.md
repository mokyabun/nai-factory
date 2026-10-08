# 5. 웹 프론트엔드

> 대상 문제: T3, T4, B1(웹 측), B4(웹 측), M4(표시), S2(설정 UI)
>
> 서버 API가 contract 기반으로 바뀐 뒤 진행한다. UI 디자인 자체는 바꾸지 않는다(같은 컴포넌트 크기 유지 원칙 포함).

## 1. API 레이어 (T3)

- `web/src/lib/api/`:
    - `client.ts`: ky 인스턴스(`credentials: 'same-origin'`). 개발 모드 base URL은 Vite 프록시(`/api` → `localhost:3000`)를 써서 CORS 자체가 필요 없게 한다.
    - `call.ts`: `call(endpoint, { params, query, body })`. 경로 치환, 쿼리 직렬화, json/form 처리, 오류를 `ApiError { status, code, message }`로 변환한다.
    - `resources.ts`, `types.ts`의 수동 정의는 **삭제**한다.
- 개발/운영 모두 같은 출처(`/api`)를 쓰므로 `VITE_API_URL` 분기가 필요 없다.
- 쿼리 키: `lib/queries.ts`의 `qk`를 contract 이름 기준으로 정리한다(`qk.scenes.list(projectId)` 등).
- `lib/optimistic.ts` 패턴은 유지하되, position과 ISO 시간에 맞춰 조정한다.

## 2. 이미지 URL (B1)

- `assetUrl(assetId)` → `/api/assets/{id}`.
- `imageResourceUrl`, `imageUrl(filePath)`와 `?v=` 캐시 버스트는 삭제한다(asset은 불변이고 ETag가 있음).
- 썸네일과 원본은 각각 `thumbAssetId`, `assetId`로 구분한다.

## 3. 시간 표시 (M4)

- `lib/time.ts`: `parseIso`, `formatDateTime`, `formatRelative`(`Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`).
- 모든 서버 시간은 ISO Z이므로 `new Date(iso)`만 쓴다. 서버 시계 보정(`serverTime`)은 큐 진행 표시에만 사용한다.

## 4. 설정 화면 (S2, B3)

- API 키 입력은 쓰기 전용으로 바꾼다.
    - 저장된 상태: `****abcd` 힌트 + "변경", "삭제" 버튼
    - 저장할 때 서버가 키를 검증하고, 실패하면 오류를 표시한다
- 설정 저장은 바뀐 필드만 PATCH한다(서버가 깊게 병합). 디바운스 저장 로직을 공용 훅 `useDebouncedPatch`로 통합한다.
- `export.serverPath` 입력은 삭제한다. 서버 내보내기는 `serverExportEnabled`일 때만 노출하고, 하위 폴더 이름만 입력받는다.
- (선택 토큰을 켠 경우) 401 응답을 받으면 토큰 입력 화면을 띄운다. 토큰은 서버가 HttpOnly 쿠키로 설정한다.

## 5. 큐 UI

- 실행 중 작업에 **취소** 버튼을 둔다.
- 실패 작업에 **다시 시도**(이어서 생성) 버튼을 두고, 진행 개수 `done/total`을 표시한다.
- 이력 목록은 `GET /jobs/history`(DB 기반)를 쓴다.
- 진행 표시는 `job.progress` 이벤트로 캐시를 직접 갱신한다(`setQueryData`).

## 6. 실시간 훅 (B4)

- EventSource가 `Last-Event-ID`를 자동으로 보낸다. `resync` 이벤트를 받았을 때만 전체 무효화한다.
- 재연결 시 NovelAI 상태 쿼리는 무효화 대상에서 제외한다.
- 기존 `use-realtime-invalidation.test.ts`를 새 이벤트 타입에 맞게 갱신한다.

## 7. 대형 파일 분리 (T4)

**`routes/project/$projectId/index.tsx` (1181줄)**

- `components/app/project/scene-grid.tsx`: DnD 그리드
- `components/app/project/scene-toolbar.tsx`: 선택, 큐, 크기, 슬라이드 개수
- `hooks/use-scene-selection.ts`: 드래그 선택 상태
- `hooks/use-project-settings.ts`: 디바운스 저장
- 라우트 파일에는 데이터 로딩과 조립만 남긴다.

**`components/app/sidebar/sidebar-project/index.tsx` (817줄)**

- `use-project-tree.ts`: 트리 상태, 펼침
- `use-project-tree-dnd.ts`: DnD 핸들러, 순환 방지
- `project-tree-actions.ts`: 생성/이름변경/삭제/복제 액션

**기타 300줄 이상 파일 점검**: `scene-card.tsx`, `settings-panel.tsx`, `character-reference-editor.tsx`, `images/index.tsx`

## 8. 변수 편집기 (B2 연계)

- 순서 변경과 삽입 후 전체 목록을 PATCH하는 방식은 유지한다(서버가 position을 재부여).
- 낙관적 업데이트의 임시 id(음수)와 서버 id를 매핑하는 로직을 점검한다.

## 완료 기준

- [ ] `resources.ts` 삭제, 모든 호출이 `call(contract…)` 사용, `tsc` 통과
- [ ] 이미지가 모두 `/api/assets/:id`로 표시됨 (개발, Docker 모두)
- [ ] 설정 화면에서 API 키 원문이 네트워크 응답에 나타나지 않음
- [ ] 큐 취소, 재시도(이어서 생성) 동작
- [ ] 페이지를 10분 켜두어도 SSE 재연결과 NovelAI 상태 호출이 반복되지 않음
- [ ] 분리 후 각 파일 400줄 이하(ui/ 제외)
