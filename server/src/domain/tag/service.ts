import { join } from 'node:path'
import FlexSearch from 'flexsearch'

export interface TagEntry {
    id: number
    alias: string
    tag: string
    category: number
    priority: number
}

let entries: TagEntry[] = []
let searchIndex: FlexSearch.Index | null = null

async function ensureLoaded() {
    if (searchIndex !== null) return

    const csvPath = join(import.meta.dir, '../../../assets/db.csv')
    const text = await Bun.file(csvPath).text()
    const lines = text.split('\n')

    const parsed: TagEntry[] = []
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
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
            id: i,
            alias,
            tag: original === 'null' || !original ? alias : original,
            category,
            priority,
        })
    }

    entries = parsed

    const idx = new FlexSearch.Index({ tokenize: 'forward', resolution: 9 })
    for (const entry of entries) {
        idx.add(entry.id, entry.alias)
    }
    searchIndex = idx
}

// Initialize on module load
ensureLoaded().catch(() => {})

export async function search(q: string, limit = 20): Promise<TagEntry[]> {
    await ensureLoaded()
    const ids = (await searchIndex!.searchAsync(q, limit * 5)) as number[]
    const seen = new Set<string>()
    const results: TagEntry[] = []

    // Sort by priority (descending) and deduplicate by canonical tag
    const matched = ids
        .map((id) => entries[id])
        .filter(Boolean)
        .sort((a, b) => b.priority - a.priority)

    for (const entry of matched) {
        if (seen.has(entry.tag)) continue
        seen.add(entry.tag)
        results.push(entry)
        if (results.length >= limit) break
    }

    return results
}
