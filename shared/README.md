# @nai-factory/shared

Zod schemas and the API contract shared by the server and the web client.

- `src/schemas/` — entity (response) schemas. Only these may use `.default()`, to normalize stored JSON.
- `src/inputs/` — request schemas. PATCH schemas list every field as `.optional()` without defaults.
- `src/contract/` — endpoint definitions (`contract.scenes.update`, …) used by the server route adapter and the web `call()` helper.
