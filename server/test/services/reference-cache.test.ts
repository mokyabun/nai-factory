import { describe, expect, it } from 'bun:test'
import { isReferenceCacheFresh, REFERENCE_CACHE_TTL_MS } from '../../src/services/reference-cache'

describe('reference cache TTL', () => {
    it('treats a fresh cache key as reusable', () => {
        const createdAt = new Date(Date.now() - REFERENCE_CACHE_TTL_MS + 1_000).toISOString()

        expect(isReferenceCacheFresh('key', createdAt)).toBe(true)
    })

    it('treats missing cache data as stale', () => {
        expect(isReferenceCacheFresh(null, new Date().toISOString())).toBe(false)
        expect(isReferenceCacheFresh('key', null)).toBe(false)
    })

    it('treats caches older than one hour as stale', () => {
        const createdAt = new Date(Date.now() - REFERENCE_CACHE_TTL_MS - 1_000).toISOString()

        expect(isReferenceCacheFresh('key', createdAt)).toBe(false)
    })
})
