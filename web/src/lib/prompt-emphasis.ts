export type PromptEmphasisKind = 'high' | 'low'

export interface PromptEmphasisRange {
    from: number
    to: number
    kind: PromptEmphasisKind
}

const NUMERIC_EMPHASIS_RE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)::/
const BRACKET_WEIGHT = 1.05

function rangeKind(weight: number): PromptEmphasisKind | null {
    if (weight > 1) return 'high'
    if (weight < 1) return 'low'
    return null
}

function currentWeight(numericWeights: number[], braceDepth: number, bracketDepth: number) {
    const numericWeight = numericWeights.reduce((weight, next) => weight * next, 1)
    const bracketWeight = BRACKET_WEIGHT ** (braceDepth - bracketDepth)
    return numericWeight * bracketWeight
}

function addRange(
    ranges: PromptEmphasisRange[],
    from: number,
    to: number,
    numericWeights: number[],
    braceDepth: number,
    bracketDepth: number,
) {
    if (from >= to) return

    const kind = rangeKind(currentWeight(numericWeights, braceDepth, bracketDepth))
    if (!kind) return

    const previous = ranges.at(-1)
    if (previous?.to === from && previous.kind === kind) {
        previous.to = to
        return
    }

    ranges.push({ from, to, kind })
}

export function parsePromptEmphasisRanges(prompt: string): PromptEmphasisRange[] {
    const ranges: PromptEmphasisRange[] = []
    const numericWeights: number[] = []
    let braceDepth = 0
    let bracketDepth = 0
    let segmentStart = 0
    let index = 0

    while (index < prompt.length) {
        const numericMatch = prompt.slice(index).match(NUMERIC_EMPHASIS_RE)
        if (numericMatch?.[0]) {
            addRange(ranges, segmentStart, index, numericWeights, braceDepth, bracketDepth)

            const marker = numericMatch[0]
            const weight = Number.parseFloat(marker.slice(0, -2))
            numericWeights.push(weight)
            addRange(ranges, index, index + marker.length, numericWeights, braceDepth, bracketDepth)

            index += marker.length
            segmentStart = index
            continue
        }

        const char = prompt[index]
        if (char === ':' && prompt[index + 1] === ':') {
            addRange(ranges, segmentStart, index, numericWeights, braceDepth, bracketDepth)

            numericWeights.pop()
            braceDepth = 0
            bracketDepth = 0
            index += 2
            segmentStart = index
            continue
        }

        if (char === '{') {
            addRange(ranges, segmentStart, index, numericWeights, braceDepth, bracketDepth)
            braceDepth += 1
            addRange(ranges, index, index + 1, numericWeights, braceDepth, bracketDepth)
            index += 1
            segmentStart = index
            continue
        }

        if (char === '[') {
            addRange(ranges, segmentStart, index, numericWeights, braceDepth, bracketDepth)
            bracketDepth += 1
            addRange(ranges, index, index + 1, numericWeights, braceDepth, bracketDepth)
            index += 1
            segmentStart = index
            continue
        }

        if (char === '}') {
            addRange(ranges, segmentStart, index, numericWeights, braceDepth, bracketDepth)
            braceDepth = Math.max(0, braceDepth - 1)
            index += 1
            segmentStart = index
            continue
        }

        if (char === ']') {
            addRange(ranges, segmentStart, index, numericWeights, braceDepth, bracketDepth)
            bracketDepth = Math.max(0, bracketDepth - 1)
            index += 1
            segmentStart = index
            continue
        }

        index += 1
    }

    addRange(ranges, segmentStart, prompt.length, numericWeights, braceDepth, bracketDepth)
    return ranges
}
