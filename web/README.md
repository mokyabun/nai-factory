# NAI Factory Web

The React SPA frontend for NAI Factory. It uses Vite, TanStack Router file routes, TanStack Query,
and the API served by `@nai-factory/server`.

## Development

From the repository root:

```bash
bun dev
```

The web app runs on port `5173` by default and waits for the API server before starting through
the root workspace script. The app always calls the API on its own origin (`/api`); in development
Vite proxies `/api` to `http://localhost:3000` (override with `NAI_FACTORY_API_TARGET`).

## API calls

Endpoints are declared once in `@nai-factory/shared` (`contract`). Call them with
`call(contract.scenes.update, { params: { id }, body })` from `src/lib/api`; failures throw an
`ApiError` with the server's `{ code, message }`. Files are loaded from `assetUrl(assetId)`.

## Workspace Commands

```bash
bun build:web
bun --filter '@nai-factory/web' check
bun --filter '@nai-factory/web' format
bun --filter '@nai-factory/web' lint
bun --filter '@nai-factory/web' test
```

## Routing

TanStack Router generates the route tree from `src/routes` during Vite startup and build. The root
route renders the shared application shell; project, scene, image, and settings views are split into
their own file routes by the Router Vite plugin.
