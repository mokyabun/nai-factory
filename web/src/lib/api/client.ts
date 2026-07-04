import ky, { HTTPError } from 'ky'
import type { ApiError, ApiRequestOptions, ApiResult, SearchParams } from './types'
import { apiPath, BASE_URL, parseText, toSearchParams } from './utils'

export const apiClient = ky.create({
    prefix: BASE_URL,
})

async function readError(error: HTTPError): Promise<ApiError> {
    const text = await error.response.text()
    return {
        status: error.response.status,
        value: parseText(text),
    }
}

function normalizeOptions(options: ApiRequestOptions) {
    return {
        ...options,
        searchParams: toSearchParams(options.searchParams),
    }
}

export async function request<T>(path: string, options: ApiRequestOptions = {}): ApiResult<T> {
    try {
        const response = await apiClient(apiPath(path), normalizeOptions(options))

        if (response.status === 204) return { data: null, error: null }

        const value = parseText(await response.text())
        return { data: value as T, error: null }
    } catch (error) {
        if (error instanceof HTTPError) return { data: null, error: await readError(error) }

        return { data: null, error: { status: 0, value: error } }
    }
}

export async function requestBlob(path: string, options: ApiRequestOptions = {}): ApiResult<Blob> {
    try {
        const response = await apiClient(apiPath(path), normalizeOptions(options))
        return { data: await response.blob(), error: null }
    } catch (error) {
        if (error instanceof HTTPError) return { data: null, error: await readError(error) }

        return { data: null, error: { status: 0, value: error } }
    }
}

function withOptionalJson(method: string, json?: unknown): ApiRequestOptions {
    return json === undefined ? { method } : { method, json }
}

export const http = {
    get: <T>(path: string, query?: SearchParams) => request<T>(path, { searchParams: query }),
    post: <T>(path: string, json?: unknown) => request<T>(path, withOptionalJson('post', json)),
    patch: <T>(path: string, json: unknown) => request<T>(path, { method: 'patch', json }),
    delete: <T>(path: string, query?: SearchParams) =>
        request<T>(path, { method: 'delete', searchParams: query }),
}
