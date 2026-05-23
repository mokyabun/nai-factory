# NAI Factory Web

`web-next` is the React SPA frontend for NAI Factory. It uses Vite, TanStack Router file routes,
TanStack Query, and the Hono API served by `server-next`.

## Development

From the repository root:

```bash
bun dev
```

The web app runs on port `5173` by default and waits for the API server before starting through
the root workspace script. Set `VITE_API_URL` when the API is hosted somewhere other than
`http://localhost:3000`.

## Workspace Commands

```bash
bun build:web
bun check:web
bun lint:web
bun test:web
```

## Routing

TanStack Router generates the route tree from `src/routes` during Vite startup and build. The root
route renders the shared application shell; project, scene, image, and settings views are split into
their own file routes by the Router Vite plugin.
