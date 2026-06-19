import { zValidator } from '@hono/zod-validator'
import { TagAutocompleteGetQuery } from '@nai-factory/shared'
import FlexSearch from 'flexsearch'
import { Hono } from 'hono'
import { appConfig } from '@/config'

interface TagEntry {
    id: number
    alias: string
    tag: string
    category: number
    priority: number
}

type TagSearchIndex = {
    add(id: number, content: string): void
    searchAsync(query: string, limit: number): Promise<unknown[]>
}

let entries: TagEntry[] = []
let searchIndex: TagSearchIndex | null = null

async function ensureLoaded() {
    if (searchIndex !== null) return

    const text = await Bun.file(appConfig.assets.tagDbPath).text()
    const parsed: TagEntry[] = []
    for (const [id, rawLine] of text.split('\n').entries()) {
        const line = rawLine.trim()
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

async function search(q: string, limit = 10) {
    await ensureLoaded()
    if (!searchIndex) return []

    const ids = (await searchIndex.searchAsync(q, limit * 5)) as number[]
    const seen = new Set<string>()
    const matched = ids
        .map((id) => entries[id])
        .filter((entry): entry is TagEntry => entry !== undefined)
        .sort((a, b) => b.priority - a.priority)
    const results: TagEntry[] = []

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
    zValidator('query', TagAutocompleteGetQuery),
    async (c) => {
        const { q, limit } = c.req.valid('query')
        return c.json(await search(q, limit))
    },
)
