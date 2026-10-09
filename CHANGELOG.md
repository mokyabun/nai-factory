# Changelog

## Unreleased

Database migrations run at startup and upgrade 0.3.0 data folders in place. Before applying
them, the server copies the database to `backups/<name>-<UTC time>.db` next to it.

- Character prompts can be placed on NovelAI's 5×5 grid. Each character card has a position
  button in its bottom-right corner that turns "캐릭터 위치 사용" on or off (it moved there from
  the parameters) and picks the cell. New characters start at the center (`C3`). Characters
  saved by 0.3.0 at `{ x: 0, y: 0 }` (in projects and prompt stash items) are moved to the
  center by the migration.
- Scene queue actions take an image count per variation. Projects have a "기본 이미지 수"
  setting (default 1), the scene selection bar has a count input with the resulting total, and
  batches above 200 images ask for confirmation, including how many of them cost Anlas.
  `POST /jobs/playground` also accepts `count`; the Playground UI queues one image.
- Size presets (portrait, landscape, square, custom) and an "Anlas 소모" badge when the size
  is above 1024×1024 pixels or steps are above 28.
- The generation dock and queue panel show the remaining images; the time estimate is based
  on them instead of on job counts.
- Images store their variation (`images.variation_id`, backfilled from metadata where the
  variation still exists). `GET /images` accepts `variationId`. Project archives record it as
  an index into the scene's variations; archives from 0.3.0 still import.
- Playground supports character prompts, and "재사용" restores them from scene and Playground
  images.
- Files the database does not know about are moved to `trash/<UTC time>/` instead of being
  deleted, and removed after 30 days. Swapping or restoring the database no longer deletes the
  images it does not list.
- Stopping the server (SIGTERM, Ctrl+C, `docker stop`) no longer waits for open browser tabs
  to disconnect.
- Docker images are tagged `1.2.3`, `1.2`, `1` and `latest` for releases and `main` for the main
  branch; `latest` no longer follows main and the `v`-prefixed tags are gone.

## 0.3.0

First public release. Data folders from earlier development versions are not compatible: start
with a new data folder.

- Rebuilt database schema with a single set of drizzle-kit migrations, millisecond UTC
  timestamps and files tracked only through the `assets` table (paths relative to the data
  folder).
- Files are served by id from `/api/assets/:id` with ETag caching; the old `/data/*` route is
  gone.
- The NovelAI API key is write-only and kept in a separate secrets table; requests from other
  sites and unknown host names are refused; optional `NAI_FACTORY_ACCESS_TOKEN`.
- Server export only writes below `NAI_FACTORY_EXPORT_DIR`.
- Unified job queue stored in the database: running jobs can be cancelled, failed jobs resume
  after the images they already saved, and finished jobs are kept as history.
- Queued scene jobs use the latest prompt, variables and references when they run.
- NovelAI requests retry rate limits and gateway errors with backoff; timeouts are not retried.
- Realtime events resume after reconnects (`Last-Event-ID`) instead of refetching everything.
- Project archives (`.naif` version 3) are streamed, verified and size-limited.
- API endpoints are defined once in `@nai-factory/shared` and shared by server and web.
