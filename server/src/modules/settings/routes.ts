import { contract, type NovelAIAccountStatus } from '@nai-factory/shared'
import type { Hono } from 'hono'

import type { AppContext, AppEnv } from '@/context'
import { NovelAIError } from '@/integrations/novelai/errors'
import { AppError, route } from '@/lib/http'

const ANLAS_CACHE_MS = 30_000

/** Caches the NovelAI account status; generations invalidate it. */
export function createAnlasCache() {
    let entry: { status: NovelAIAccountStatus; expiresAt: number } | null = null
    return {
        get: () => (entry && entry.expiresAt > Date.now() ? entry.status : null),
        set(status: NovelAIAccountStatus) {
            entry = { status, expiresAt: Date.now() + ANLAS_CACHE_MS }
        },
        invalidate() {
            entry = null
        },
    }
}

async function accountStatus(ctx: AppContext): Promise<NovelAIAccountStatus> {
    const mode = ctx.settings.get().novelai.mode
    const base = { mode, updatedAt: new Date().toISOString() }

    if (mode === 'mock') {
        return { ...base, configured: true, unlimited: false, anlas: 12345, error: null }
    }
    if (mode === 'fail') {
        return {
            ...base,
            configured: true,
            unlimited: false,
            anlas: null,
            error: 'NovelAI fail test mode',
        }
    }

    const apiKey = ctx.settings.apiKey()
    if (!apiKey) return { ...base, configured: false, unlimited: false, anlas: null, error: null }

    const cached = ctx.anlasCache.get()
    if (cached) return cached

    try {
        const status = await ctx.novelai.fetchAnlas(apiKey)
        const result = { ...base, configured: true, ...status, error: null }
        ctx.anlasCache.set(result)
        return result
    } catch (error) {
        ctx.log.warn(
            { event: 'novelai.account_status.failed', err: error },
            'NovelAI account status failed',
        )
        return {
            ...base,
            configured: true,
            unlimited: false,
            anlas: null,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

export function registerSettingsRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    const api = contract.settings
    route(app, api.get, () => ctx.settings.view())
    route(app, api.update, ({ body }) => {
        ctx.settings.update(body)
        return ctx.settings.view()
    })
    route(app, api.reset, () => {
        ctx.settings.reset()
        return ctx.settings.view()
    })
    route(app, api.setNovelAIKey, async ({ body }) => {
        try {
            await ctx.novelai.verifyApiKey(body.apiKey)
        } catch (error) {
            if (error instanceof NovelAIError && error.kind === 'auth') {
                throw new AppError(400, 'bad_request', 'NovelAI rejected the API key')
            }
            throw new AppError(
                502,
                'upstream_error',
                `Could not verify the API key: ${error instanceof Error ? error.message : String(error)}`,
            )
        }
        ctx.settings.setApiKey(body.apiKey)
        ctx.anlasCache.invalidate()
        return ctx.settings.view()
    })
    route(app, api.deleteNovelAIKey, () => {
        ctx.settings.deleteApiKey()
        ctx.anlasCache.invalidate()
        return ctx.settings.view()
    })
    route(app, api.novelAIStatus, () => accountStatus(ctx))
}
