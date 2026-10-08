# 6. 릴리스 준비

> 대상 문제: B1(Docker 검증), M1(CI 검사), T5
>
> 첫 배포 전 마지막 단계.

## 1. Docker

- `Dockerfile`:
    - `server/dist/migrations`(drizzle 생성물)를 런타임 이미지에 복사한다.
    - `tag-search-index.json`과 `db.csv` 등 런타임에 필요한 asset 목록을 정리한다(실제로 읽는 파일만 복사).
    - `ENV HOST=0.0.0.0`(컨테이너 내부). `NAI_FACTORY_DATA_DIR=/app/server/data`처럼 절대경로를 유지한다. 새 설계에서는 상대경로를 저장하므로 B1이 재발하지 않는다.
    - 빌드 인자 `VITE_API_URL`을 삭제한다(웹이 항상 `/api` 같은 출처를 사용).
- `docker-compose.yml`:
    - `ports: ['127.0.0.1:3000:3000']`을 기본으로 둔다. LAN 공개 방법은 주석으로 안내한다.
    - 선택 env 예시(주석): `NAI_FACTORY_ACCESS_TOKEN`, `NAI_FACTORY_ALLOWED_HOSTS`, `NAI_FACTORY_EXPORT_DIR`(+ 볼륨), `NAI_FACTORY_DATA_ENCRYPTION_*`
    - `DATABASE_URL` 중복 지정을 삭제한다(데이터 폴더 기본값 사용).

## 2. CI

`.github/workflows/ci.yml`:

1. `oven-sh/setup-bun@v2`의 `bun-version`을 `1.4.x`로 고정한다.
2. `bun install --frozen-lockfile`
3. `bun run check` (format, lint, typecheck)
4. `bun run test`
5. **마이그레이션 검사**:
    - `bun --filter @nai-factory/server drizzle-kit check`
    - `drizzle-kit generate` 실행 후 `git diff --exit-code server/src/db/migrations` (스키마와 마이그레이션 불일치 감지)
6. `bun run build`
7. **Docker 스모크 테스트**(별도 job):
    - 이미지를 빌드하고 컨테이너를 실행한다(`NAI_FACTORY_NOVELAI_MODE=mock` 또는 설정 API로 mock 전환)
    - `/healthz` 200
    - 프로젝트, 씬, 변수 생성 → 작업 enqueue → start → 이미지 1장 생성 대기
    - `/api/assets/:id` 200 (B1 재발 방지)
    - 다른 Host 헤더의 요청 → 403

`docker.yml`은 main 푸시와 태그에서만 push하는 현재 구조를 유지한다. 스모크 테스트 job이 성공해야 push한다.

## 3. README

- 설치/실행 방법(개발: `bun dev`, Docker)
- **보안 안내**:
    - 기본은 로컬(127.0.0.1)에서만 접속 가능
    - LAN 공개 방법과 위험(같은 네트워크 사용자는 API 키를 쓸 수 있음, 키를 읽을 수는 없음), 선택 토큰 설정
    - 서버 경로 내보내기 사용법(`NAI_FACTORY_EXPORT_DIR`)
- 환경변수 표(`config.ts`와 일치시킨다)
- 데이터 폴더 구조(`database.db`, `images/`, `thumbs/`, `refs/` …)와 백업 방법
- 개발자 안내: 스키마를 바꾸면 `bun db:generate`를 실행하고, 적용된 마이그레이션은 수정하지 않는다
- 스크린샷 갱신(UI 변경분이 있을 경우)

## 4. 버전

- `0.3.0`(또는 첫 공개 버전 `1.0.0`). 루트, server, web, shared의 package.json 버전을 통일한다.
- `CHANGELOG.md`를 새로 만든다. 첫 항목은 "초기 공개 버전, 이전 개발 버전 DB와 호환되지 않음"으로 한다.

## 5. 최종 점검 체크리스트

- [ ] `0overview-plan.md`의 S/B/C/M/T 항목이 모두 해결되었거나 의도적으로 보류(사유 기록)되었다
- [ ] 각 단계 문서의 회귀 테스트가 모두 존재하고 통과한다
- [ ] 빈 데이터 폴더에서 Docker로 처음 실행 → 설정 → API 키 → 생성 → 내보내기까지 수동 확인
- [ ] `git ls-files`에 `.env`, `*.db`, `data/`가 없다
- [ ] `plans/` 문서를 `docs/architecture.md` 한 장으로 요약하고, 계획 문서는 보관하거나 삭제한다
