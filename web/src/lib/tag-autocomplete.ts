import {
    type Completion,
    type CompletionContext,
    type CompletionResult,
    type CompletionSource,
    insertCompletionText,
} from '@codemirror/autocomplete'
import type { PromptVariable, Tag } from '@nai-factory/shared'
import { api } from './api'

// Delimiters that separate tags in a NAI prompt
const DELIMITERS = new Set([',', '{', '}', '[', ']', '|', '\n'])
const TAG_CACHE_LIMIT = 200
const VARIABLE_TOKEN_RE = /(?:^|[\s(])([^\s()]*)$/
const WEIGHTED_TAG_RE = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+)::)([^:]*)$/

const tagCache = new Map<string, Promise<Tag[]> | Tag[]>()

function setTagCache(key: string, value: Promise<Tag[]> | Tag[]) {
    if (!tagCache.has(key) && tagCache.size >= TAG_CACHE_LIMIT) {
        const firstKey = tagCache.keys().next().value
        if (firstKey) tagCache.delete(firstKey)
    }
    tagCache.set(key, value)
}

async function fetchTags(q: string, limit: number): Promise<Tag[]> {
    const cacheKey = `${limit}:${q}`
    const cached = tagCache.get(cacheKey)
    if (cached) return cached

    const pending = api.tags.autocomplete
        .get({ query: { q, limit } })
        .then(({ data, error }) => {
            const tags = error ? [] : (data ?? [])
            setTagCache(cacheKey, tags)
            return tags
        })
        .catch(() => {
            tagCache.delete(cacheKey)
            return []
        })

    setTagCache(cacheKey, pending)
    return pending
}

function variableCompletionSource(
    context: CompletionContext,
    variables: PromptVariable,
): CompletionResult | null {
    const { state, pos } = context
    const line = state.doc.lineAt(pos)
    const textBefore = line.text.slice(0, pos - line.from)
    const openIndex = textBefore.lastIndexOf('<<')
    if (openIndex === -1) return null

    const closeIndex = textBefore.lastIndexOf('>>')
    if (closeIndex > openIndex) return null

    const content = textBefore.slice(openIndex + 2)
    const token = content.match(VARIABLE_TOKEN_RE)?.[1] ?? ''
    if (!context.explicit && content !== '' && token.length < 1) return null

    const from = pos - token.length
    const normalizedVariables = variables
        .map((variable) => variable.key.trim())
        .filter((key, index, keys) => key && keys.indexOf(key) === index)

    if (normalizedVariables.length === 0) return null

    const options: Completion[] = normalizedVariables.map((key) => ({
        label: key,
        detail: 'variable',
        type: 'variable',
        apply: (view, _completion, completionFrom, completionTo) => {
            const suffix = view.state.sliceDoc(completionTo, completionTo + 2)
            view.dispatch(
                insertCompletionText(
                    view.state,
                    suffix === '>>' ? key : `${key}>>`,
                    completionFrom,
                    completionTo,
                ),
            )
        },
    }))

    return {
        from,
        options,
        validFor: /^[^\s()<>]*$/,
    }
}

function tagCompletionToken(
    lineFrom: number,
    textBefore: string,
): { from: number; query: string; weighted: boolean } | null {
    let tokenStart = 0
    for (let i = textBefore.length - 1; i >= 0; i--) {
        if (DELIMITERS.has(textBefore[i])) {
            tokenStart = i + 1
            break
        }
    }

    const tokenText = textBefore.slice(tokenStart)
    const trimmed = tokenText.trimStart()
    const from = lineFrom + tokenStart + (tokenText.length - trimmed.length)
    const weighted = trimmed.match(WEIGHTED_TAG_RE)

    if (weighted) {
        return {
            from: from + weighted[1].length,
            query: weighted[2],
            weighted: true,
        }
    }

    return { from, query: trimmed, weighted: false }
}

export async function tagCompletionSource(
    context: CompletionContext,
): Promise<CompletionResult | null> {
    const { state, pos } = context
    const line = state.doc.lineAt(pos)
    const textBefore = line.text.slice(0, pos - line.from)
    const token = tagCompletionToken(line.from, textBefore)
    if (!token) return null

    if (!token.query || (!context.explicit && token.query.length < 2)) return null

    try {
        const data = await fetchTags(token.query, 20)
        if (context.aborted || !data.length) return null

        return {
            from: token.from,
            filter: false,
            options: data.map((item) => ({
                label: item.tag,
                detail: item.alias !== item.tag ? `← ${item.alias}` : undefined,
                boost: Math.log10(item.priority + 1),
                type: 'keyword',
                apply: token.weighted
                    ? (view, _completion, from, to) => {
                          const suffix = view.state.sliceDoc(to, to + 2)
                          view.dispatch(
                              insertCompletionText(
                                  view.state,
                                  suffix === '::' ? item.tag : `${item.tag}::`,
                                  from,
                                  to,
                              ),
                          )
                      }
                    : undefined,
            })),
        }
    } catch {
        return null
    }
}

export function createPromptCompletionSource(variables: PromptVariable = []): CompletionSource {
    return (context) => variableCompletionSource(context, variables) ?? tagCompletionSource(context)
}
