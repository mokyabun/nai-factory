import { join } from 'node:path'

import { defineConfig } from 'drizzle-kit'

// Mirrors the server default: <NAI_FACTORY_DATA_DIR or ./data>/database.db
const dataDir = process.env.NAI_FACTORY_DATA_DIR ?? './data'

export default defineConfig({
    dialect: 'sqlite',
    schema: './src/db/schema/index.ts',
    out: './src/db/migrations',
    dbCredentials: {
        url: process.env.DATABASE_URL ?? join(dataDir, 'database.db'),
    },
})
