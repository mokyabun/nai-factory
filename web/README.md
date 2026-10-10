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
their own file routes by the Router Vite plugin. Route files are stubs: they read the route params
and render a page from `src/features`.

## Source layout

```
src/
  main.tsx, router.tsx, styles.css, routeTree.gen.ts
  routes/               stubs: createFileRoute + params → <FeaturePage …/>
  app/                  composition root: shell, header, sidebar frame, realtime wiring
  features/
    queue/              queue status/actions, queue panel, generation dock, progress UI
    images/             scene image grid + viewer, image surface/metadata/reuse
    prompt/             project prompt panel, prompt/character/vibe/reference editors, parameter form
    playground/         playground panel + playground page
    scene/              scene editor page (variations, prompt preview)
    project/            project page: scene grid/cards/toolbar, project dialogs, scene mutations
    project-tree/       sidebar project navigator: groups/projects tree and their dialogs
    import/             file drop, .naif / scene JSON / SD Studio import
    settings/           settings page
    log/                debug request log page
  components/
    ui/                 shadcn primitives
    code-editor/        CodeMirror editor + prompt emphasis
    form-fields.tsx, status-message.tsx, confirm-delete-dialog.tsx
  hooks/                generic hooks only
  lib/                  infrastructure + domain helpers shared by several features
```

### Layer rules

| Layer            | May import from                                              |
| ---------------- | ------------------------------------------------------------ |
| `routes/`        | `app/`, `features/*`, `components/`, `hooks/`, `lib/`        |
| `app/`           | `features/*`, `components/`, `hooks/`, `lib/`                |
| `features/<x>/`  | the features listed below, `components/`, `hooks/`, `lib/`   |
| `components/`    | `components/`, `hooks/`, `lib/`: never `features/` or `app/` |
| `hooks/`, `lib/` | `hooks/`, `lib/`: never `components/`, `features/` or `app/` |

```
app ───────► every feature
playground ► prompt, images, queue
project ───► queue
import ────► images
queue, images, prompt, scene, project-tree, settings, log ► (no features)
```

Code used by one feature lives in that feature. Code used by several features moves down to
`components/`, `hooks/` or `lib/`, unless it is the core of a feature others build on (the queue,
the prompt editors); those edges are the ones above. `lib/queries.ts` stays central because
realtime invalidation and optimistic updates address each other's query keys.

`bun run lint` enforces the feature edges and the `app/` boundary (`no-restricted-imports`
overrides in `.oxlintrc.json`), forbids import cycles and `../` imports.

### Code style

- **No unnecessary comments.** Code explains itself through names and small functions. A comment
  is allowed only when the _why_ is not visible from the code (a browser quirk, a server contract).
- **Clear names over short names.** A file is named after what it exports, in kebab-case
  (`archive-option.tsx` → `ArchiveOption`). Hooks are `use-*.ts`, pages `*-page.tsx`, sidebar
  panels `*-panel.tsx`.
- **One concern per file.** No `*-parts`, `*-utils` or `*-types` grab bags; a helper lives next to
  its only user, or in its own named module when several files use it.
- **Imports:** `./x` within the same folder, `@/…` for everything else. No `../`. No barrel
  `index.ts` files (`lib/api/index.ts`, the API facade, is the exception). Barrels would pull the
  lazily loaded sidebar panels into the chunks of pages that only need one editor.
- **Flat feature folders.** Tests live next to their module.
- **Route files are minimal:** `createFileRoute` plus a component that reads params and renders the
  page.
