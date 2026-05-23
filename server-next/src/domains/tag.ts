import { join } from 'node:path'
import { zValidator } from '@hono/zod-validator'
import { TagAutocompleteQuery } from '@nai-factory/types'
import FlexSearch from 'flexsearch'
import { Hono } from 'hono'

interface TagEntry {
    id: number
    alias: string
    tag: string
    category: number
    priority: number
}

let entries: TagEntry[] = []
let searchIndex: InstanceType<typeof FlexSearch.Index> | null = null

async function ensureLoaded() {
    if (searchIndex !== null) return

    const csvPath = join(import.meta.dir, '../../assets/db.csv')
    const lines = (await Bun.file(csvPath).text()).split('\n')
    const parsed: TagEntry[] = []

    for (let id = 0; id < lines.length; id++) {
        const line = lines[id]?.trim()
        if (!line) continue

        const comma1 = line.indexOf(',')
        const comma2 = line.indexOf(',', comma1 + 1)
        const comma3 = line.indexOf(',', comma2 + 1)
        if (comma1 === -1 || comma2 === -1 || comma3 === -1) continue

        const alias = line.slice(0, comma1)
        const category = Number(line.slice(comma1 + 1, comma2))
        const priority = Number(line.slice(comma2 + 1, comma3))
        const original = line.slice(comma3 + 1)

        parsed.push({
            id,
            alias,
            tag: original === 'null' || !original ? alias : original,
            category,
            priority,
        })
    }

    entries = parsed
    const index = new FlexSearch.Index({ tokenize: 'forward', resolution: 9 })
    for (const entry of entries) index.add(entry.id, entry.alias)
    searchIndex = index
}

ensureLoaded().catch(() => {})

async function search(q: string, limit: number) {
    await ensureLoaded()
    const index = searchIndex
    if (!index) return []

    const ids = (await index.searchAsync(q, limit * 5)) as number[]
    const seen = new Set<string>()
    const results: TagEntry[] = []
    const matched = ids
        .map((id) => entries[id])
        .filter((entry): entry is TagEntry => Boolean(entry))
        .sort((a, b) => b.priority - a.priority)

    for (const entry of matched) {
        if (seen.has(entry.tag)) continue
        seen.add(entry.tag)
        results.push(entry)
        if (results.length >= limit) break
    }

    return results
}

export const tag = new Hono().get(
    '/autocomplete',
    zValidator('query', TagAutocompleteQuery),
    async (c) => {
        const { q, limit } = c.req.valid('query')
        return c.json(await search(q, limit))
    },
)
