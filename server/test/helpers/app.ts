import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
    buildPath,
    type EndpointBody,
    type EndpointDef,
    type EndpointParams,
    type EndpointQuery,
    type EndpointResponse,
} from '@nai-factory/shared'

import { createApp } from '@/app'
import { closeContext, type ContextOptions, createContext } from '@/bootstrap'
import { type Env, loadConfig } from '@/config'
import logger from '@/logger'

export type CallInput<E extends EndpointDef> = {
    params?: EndpointParams<E>
    query?: EndpointQuery<E>
    body?: EndpointBody<E>
    headers?: Record<string, string>
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>

function toQueryString(query: unknown) {
    if (!query || typeof query !== 'object') return ''
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue
        params.set(key, Array.isArray(value) ? value.join(',') : String(value))
    }
    const text = params.toString()
    return text ? `?${text}` : ''
}

/**
 * An app with its own temporary data folder (in-memory database by default) and NovelAI in
 * mock mode unless overridden.
 */
export async function createTestApp(
    options: { env?: Env; inMemory?: boolean } & ContextOptions = {},
) {
    const dataDir = await mkdtemp(join(tmpdir(), 'nai-factory-test-'))
    const config = loadConfig({
        NODE_ENV: 'test',
        NAI_FACTORY_DATA_DIR: dataDir,
        NAI_FACTORY_NOVELAI_MODE: 'mock',
        ...(options.inMemory === false ? {} : { DATABASE_URL: ':memory:' }),
        ...options.env,
    })
    const ctx = createContext(config, logger, { novelaiRetryBaseDelayMs: 1, ...options })
    const app = createApp(ctx)

    async function request(path: string, init: RequestInit = {}) {
        return app.request(`http://localhost:3000${path}`, init)
    }

    async function send<E extends EndpointDef>(endpoint: E, input: CallInput<E> = {}) {
        const path = `/api${buildPath(endpoint.path, input.params as Record<string, unknown>)}${toQueryString(input.query)}`
        const headers: Record<string, string> = { ...input.headers }
        let body: RequestInit['body']
        if (input.body !== undefined) {
            if (endpoint.bodyType === 'form') {
                const form = new FormData()
                for (const [key, value] of Object.entries(input.body as Record<string, unknown>)) {
                    form.set(key, value instanceof Blob ? value : String(value))
                }
                body = form
            } else {
                headers['content-type'] = 'application/json'
                body = JSON.stringify(input.body)
            }
        }
        return request(path, { method: endpoint.method, headers, body })
    }

    /** Calls an endpoint and returns its parsed JSON, failing on non-2xx responses. */
    async function call<E extends EndpointDef>(endpoint: E, input: CallInput<E> = {}) {
        const response = await send(endpoint, input)
        if (!response.ok) {
            throw new Error(
                `${endpoint.method} ${endpoint.path} → ${response.status}: ${await response.text()}`,
            )
        }
        if (response.status === 204 || endpoint.response === null)
            return null as EndpointResponse<E>
        if (endpoint.response === 'binary') return (await response.blob()) as EndpointResponse<E>
        return (await response.json()) as EndpointResponse<E>
    }

    async function close() {
        await closeContext(ctx)
        await rm(dataDir, { recursive: true, force: true })
    }

    return { ctx, app, config, dataDir, request, send, call, close }
}
