# Architecture

NAI Factory is a Bun workspace with three packages:

| Package               | Role                                                                    |
| --------------------- | ----------------------------------------------------------------------- |
| `@nai-factory/shared` | Zod schemas (`schemas/`), request inputs (`inputs/`), API `contract/`   |
| `@nai-factory/server` | Hono API, SQLite (drizzle), job queue, NovelAI client, static web files |
| `@nai-factory/web`    | React SPA (TanStack Router and Query)                                   |

## API contract

Every JSON endpoint is declared once in `shared/src/contract` with its method, path and Zod
schemas. The server registers it with `route(app, contract.scenes.update, handler)`, which
validates params, query and body (and, outside production, the response). The web calls it with
`call(contract.scenes.update, { params, body })`. Errors are `{ error: { code, message } }`.

Entity schemas (`schemas/`) may use `.default()` to normalize stored JSON. Request schemas
(`inputs/`) never do; PATCH bodies list optional fields only and the server deep-merges them into
the stored value before validating the result.

## Server

```
server/src/
  index.ts, app.ts, bootstrap.ts   startup, middleware, context wiring
  config.ts, logger.ts
  db/        schema/, migrations/ (drizzle-kit output, never edited), client.ts
  lib/       paths, storage (AES-GCM), mime, order (fractional keys), http, zip, merge
  modules/   <name>/{routes,service,repo}.ts
  integrations/novelai/   client (retries, timeouts), request builder, multipart, mock
```

- Routes only validate and call services. Services own transactions; repos hold queries and
  take the database or a transaction. Modules use each other's services, never their repos.
- `bun:sqlite` is synchronous, so transactions never await. Files are written before the
  transaction that records them and removed after the one that deletes their rows; the asset
  GC removes leftovers (unreferenced rows, and unknown files older than ten minutes).
- Times are Unix milliseconds in the database and ISO-8601 UTC strings in the API.
- Ordered lists use fractional `position` keys without a unique index; ties sort by id.

## Queue

`jobs` holds scene and playground jobs. Scene jobs reference a project, scene and variation and
are compiled from the latest data before every image; playground jobs store a prompt snapshot.
A single loop runs queued jobs in `priority_key` order; it picks the next job and decides to stop
in one synchronous step. Each image is generated outside a transaction and recorded with
`done_images` in one transaction, so a retried job continues where it failed. Deleting a running
job aborts its NovelAI request. Jobs left `running` by a crash are requeued at startup.

## Security

Without accounts, the server relies on: loopback binding by default, a Host allowlist (DNS
rebinding), Origin and `Sec-Fetch-Site` checks for state-changing requests (CSRF), no CORS in
production, a write-only API key, files served by id only, and an optional access token.

## Realtime

`GET /api/events` streams server-sent events with increasing ids and a heartbeat. The server keeps
the last 500 events; a reconnecting client sends `Last-Event-ID` and receives what it missed, or a
`resync` event when that is no longer possible.
