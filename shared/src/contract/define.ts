import type * as z from 'zod'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

/** Paths are relative to `/api` and use `:name` placeholders. */
export interface EndpointDef {
    method: HttpMethod
    path: string
    params?: z.ZodType
    query?: z.ZodType
    body?: z.ZodType
    /** `form` bodies are sent as multipart/form-data. Defaults to `json`. */
    bodyType?: 'json' | 'form'
    /** JSON response schema; `null` for 204 No Content, `'binary'` for file downloads. */
    response: z.ZodType | null | 'binary'
    /** Success status for JSON responses. Defaults to 200. */
    status?: 200 | 201
}

export function endpoint<const E extends EndpointDef>(definition: E): E {
    return definition
}

type OutputOf<S> = S extends z.ZodType ? z.output<S> : undefined
type InputOf<S> = S extends z.ZodType ? z.input<S> : undefined

export type EndpointParams<E extends EndpointDef> = OutputOf<E['params']>
export type EndpointQuery<E extends EndpointDef> = OutputOf<E['query']>
/** What a client sends; the server receives {@link EndpointParsedBody}. */
export type EndpointBody<E extends EndpointDef> = InputOf<E['body']>
export type EndpointParsedBody<E extends EndpointDef> = OutputOf<E['body']>
export type EndpointResponse<E extends EndpointDef> = E['response'] extends z.ZodType
    ? z.output<E['response']>
    : E['response'] extends 'binary'
      ? Blob
      : null

export function buildPath(path: string, params: Record<string, unknown> | undefined) {
    return path.replace(/:([A-Za-z_]\w*)/g, (_, name: string) => {
        const value = params?.[name]
        if (value === undefined || value === null) {
            throw new Error(`Missing path parameter: ${name}`)
        }
        return encodeURIComponent(String(value as string | number))
    })
}
