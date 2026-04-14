import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import { makeTestDb } from '@/test-utils/db'

const testDb = makeTestDb()

mock.restore()
mock.module('@/db', () => testDb)
afterAll(() => mock.restore())

// `require` is synchronous — no interleaving with other files' mock.module() calls
const settingsService = require('./settings') as typeof import('./settings')

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('settings service', () => {
    beforeEach(() => {
        // Reset to defaults between tests
        settingsService.reset()
    })

    describe('get', () => {
        it('returns settings with default values', () => {
            const s = settingsService.get()
            expect(s.novelai.apiKey).toBe('')
            expect(s.globalVariables).toEqual({})
            expect(s.image.sourceType).toEqual({ type: 'png' })
        })

        it('returns a readonly reference (cache object)', () => {
            const a = settingsService.get()
            const b = settingsService.get()
            expect(a).toBe(b)
        })
    })

    describe('update', () => {
        it('merges a partial patch into the current settings', () => {
            settingsService.update({ novelai: { apiKey: 'my-key' } })
            const s = settingsService.get()
            expect(s.novelai.apiKey).toBe('my-key')
        })

        it('keeps other fields unchanged after a partial update', () => {
            settingsService.update({ globalVariables: { foo: 'bar' } })
            const s = settingsService.get()
            expect(s.novelai.apiKey).toBe('')
            expect(s.globalVariables).toEqual({ foo: 'bar' })
        })

        it('returns the updated settings', () => {
            const result = settingsService.update({ novelai: { apiKey: 'updated' } })
            expect(result.novelai.apiKey).toBe('updated')
        })
    })

    describe('reset', () => {
        it('restores default values after updates', () => {
            settingsService.update({ novelai: { apiKey: 'old-key' } })
            settingsService.reset()

            const s = settingsService.get()
            expect(s.novelai.apiKey).toBe('')
        })

        it('subsequent get() returns fresh defaults after reset', () => {
            settingsService.update({ globalVariables: { x: '1' } })
            settingsService.reset()

            expect(settingsService.get().globalVariables).toEqual({})
        })
    })
})
