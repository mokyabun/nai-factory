# Development

See [Architecture](architecture.md) for how the code is organized.

Requires [Bun](https://bun.sh/).

```sh
bun install
bun dev                    # API at http://localhost:3000, web at http://localhost:5173
bun run build              # Build for production
bun run test               # Run tests
bun run check              # Check formatting, lint, and types
bun run format             # Format with Oxfmt
bun run lint               # Lint with Oxlint (type-aware)
bun db:generate            # Generate a migration after changing server/src/db/schema
```

- API endpoints are declared once in `shared/src/contract`; the server registers them with
  `route()` and the web app calls them with `call()`.
- After changing the schema, run `bun db:generate` and commit the migration. Never edit a
  released migration. See [AGENTS.md](../AGENTS.md) for details.
