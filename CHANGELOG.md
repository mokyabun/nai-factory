# Changelog

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
