import type { Tag } from '@nai-factory/shared'
import FlexSearch from 'flexsearch'

import tagSearchAsset from '../../../assets/tag-search-index.json'

type TagSearchAsset = { entries: Tag[]; index: Record<string, string> }

let searchIndex: { search(query: string, limit: number): unknown[] } | null = null
const { entries, index: exportedIndex } = tagSearchAsset as TagSearchAsset

function getIndex() {
    if (!searchIndex) {
        const index = new FlexSearch.Index({ tokenize: 'forward', resolution: 9 })
        for (const [key, data] of Object.entries(exportedIndex)) index.import(key, data)
        searchIndex = index
    }
    return searchIndex
}

export function search(query: string, limit = 20): Tag[] {
    const ids = getIndex().search(query, limit * 5) as number[]
    const matched = ids
        .map((id) => entries[id])
        .filter((entry): entry is Tag => entry !== undefined)
        .sort((a, b) => b.priority - a.priority)

    const seen = new Set<string>()
    const results: Tag[] = []
    for (const entry of matched) {
        if (seen.has(entry.tag)) continue
        seen.add(entry.tag)
        results.push(entry)
        if (results.length >= limit) break
    }
    return results
}
