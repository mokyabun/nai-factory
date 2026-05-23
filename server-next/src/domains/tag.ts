import { join } from 'node:path'
import { zValidator } from '@hono/zod-validator'
<<<<<<< HEAD
import { TagAutocompleteGetQuery } from '@nai-factory/types'
import FlexSearch from 'flexsearch'
import { Hono } from 'hono'

export interface TagEntry {
=======
import { TagAutocompleteQuery } from '@nai-factory/types'
import FlexSearch from 'flexsearch'
import { Hono } from 'hono'

interface TagEntry {
>>>>>>> refs/remotes/origin/main
    id: number
    alias: string
    tag: string
    category: number
    priority: number
}

<<<<<<< HEAD
type TagSearchIndex = {
    add(id: number, content: string): void
    searchAsync(query: string, limit: number): Promise<unknown[]>
}

let entries: TagEntry[] = []
let searchIndex: TagSearchIndex | null = null
=======
let entries: TagEntry[] = []
let searchIndex: InstanceType<typeof FlexSearch.Index> | null = null
>>>>>>> refs/remotes/origin/main

async function ensureLoaded() {
    if (searchIndex !== null) return

<<<<<<< HEAD
    const text = await Bun.file(join(import.meta.dir, '../../../server/assets/db.csv')).text()
    const parsed: TagEntry[] = []
    for (const [id, rawLine] of text.split('\n').entries()) {
        const line = rawLine.trim()
=======
    const csvPath = join(import.meta.dir, '../../assets/db.csv')
    const lines = (await Bun.file(csvPath).text()).split('\n')
    const parsed: TagEntry[] = []

    for (let id = 0; id < lines.length; id++) {
        const line = lines[id]?.trim()
>>>>>>> refs/remotes/origin/main
        if (!line) continue

        const comma1 = line.indexOf(',')
        const comma2 = line.indexOf(',', comma1 + 1)
        const comma3 = line.indexOf(',', comma2 + 1)
        if (comma1 === -1 || comma2 === -1 || comma3 === -1) continue

        const alias = line.slice(0, comma1)
<<<<<<< HEAD
        const original = line.slice(comma3 + 1)
        parsed.push({
            id,
            alias,
            category: Number(line.slice(comma1 + 1, comma2)),
            priority: Number(line.slice(comma2 + 1, comma3)),
            tag: original === 'null' || !original ? alias : original,
=======
        const category = Number(line.slice(comma1 + 1, comma2))
        const priority = Number(line.slice(comma2 + 1, comma3))
        const original = line.slice(comma3 + 1)

        parsed.push({
            id,
            alias,
            tag: original === 'null' || !original ? alias : original,
            category,
            priority,
>>>>>>> refs/remotes/origin/main
        })
    }

    entries = parsed
    const index = new FlexSearch.Index({ tokenize: 'forward', resolution: 9 })
    for (const entry of entries) index.add(entry.id, entry.alias)
    searchIndex = index
}

ensureLoaded().catch(() => {})

<<<<<<< HEAD
async function search(q: string, limit = 20) {
    await ensureLoaded()
    if (!searchIndex) return []

    const ids = (await searchIndex.searchAsync(q, limit * 5)) as number[]
    const seen = new Set<string>()
    const matched = ids
        .map((id) => entries[id])
        .filter((entry): entry is TagEntry => entry !== undefined)
        .sort((a, b) => b.priority - a.priority)
    const results: TagEntry[] = []
=======
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

>>>>>>> refs/remotes/origin/main
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
<<<<<<< HEAD
    zValidator('query', TagAutocompleteGetQuery),
=======
    zValidator('query', TagAutocompleteQuery),
>>>>>>> refs/remotes/origin/main
    async (c) => {
        const { q, limit } = c.req.valid('query')
        return c.json(await search(q, limit))
    },
)
