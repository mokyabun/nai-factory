import { zValidator } from '@hono/zod-validator'
import { TagAutocompleteGetQuery } from '@nai-factory/shared'
import FlexSearch from 'flexsearch'
import { Hono } from 'hono'
import tagSearchAsset from '../../assets/tag-search-index.json'

interface TagEntry {
    id: number
    alias: string
    tag: string
    category: number
    priority: number
}

type TagSearchIndex = {
    import(key: string, data: string): void
    search(query: string, limit: number): unknown[]
}

type TagSearchAsset = {
    entries: TagEntry[]
    index: Record<string, string>
}

const { entries, index: exportedIndex } = tagSearchAsset as TagSearchAsset

function createSearchIndex(): TagSearchIndex {
    const index = new FlexSearch.Index({ tokenize: 'forward', resolution: 9 })
    for (const [key, data] of Object.entries(exportedIndex)) index.import(key, data)
    return index
}

const searchIndex = createSearchIndex()

function search(q: string, limit = 10) {
    const ids = searchIndex.search(q, limit * 5) as number[]
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
        return c.json(search(q, limit))
    },
)
