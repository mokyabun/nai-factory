import * as z from 'zod'

import { IsoDateTime } from './common'

export const DebugRequestStatus = z.enum(['pending', 'success', 'error'])
export type DebugRequestStatus = z.infer<typeof DebugRequestStatus>

export const DebugRequest = z.object({
    id: z.number(),
    status: DebugRequestStatus,
    method: z.string(),
    url: z.string(),
    context: z.record(z.string(), z.unknown()),
    request: z.unknown(),
    response: z.unknown(),
    error: z.string().nullable(),
    durationMs: z.number().nullable(),
    createdAt: IsoDateTime,
    completedAt: IsoDateTime.nullable(),
})
export type DebugRequest = z.infer<typeof DebugRequest>

export const GcReport = z.object({
    dryRun: z.boolean(),
    orphanAssets: z.array(z.object({ id: z.number(), relPath: z.string() })),
    orphanFiles: z.array(z.string()),
})
export type GcReport = z.infer<typeof GcReport>
