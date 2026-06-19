import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import FlexSearch from 'flexsearch'

interface TagEntry {
    id: number
    alias: string
    tag: string
    category: number
    priority: number
}

type ExportedIndex = Record<string, string>

const sourcePath = join(import.meta.dir, '../assets/db.csv')
const outputPath = join(import.meta.dir, '../assets/tag-search-index.json')

function parseTagDb(text: string): TagEntry[] {
    const parsed: TagEntry[] = []

    for (const rawLine of text.split('\n')) {
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
            id: parsed.length,
            alias,
            tag: original === 'null' || !original ? alias : original,
            category,
            priority,
        })
    }

    return parsed
}

async function main() {
    const text = await Bun.file(sourcePath).text()
    const entries = parseTagDb(text)
    const index = new FlexSearch.Index({ tokenize: 'forward', resolution: 9 })

    for (const entry of entries) index.add(entry.id, entry.alias)

    const exportedIndex: ExportedIndex = {}
    await index.export((key, data) => {
        exportedIndex[key] = data
    })

    await mkdir(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, `${JSON.stringify({ entries, index: exportedIndex })}\n`)

    console.log(`Wrote ${entries.length} tags to ${outputPath}`)
}

await main()
