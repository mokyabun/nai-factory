import * as z from 'zod'

import { IsoDateTime, PromptVariable } from './common'

const PngImageSaveType = z.object({ type: z.literal('png') })
const WebpImageSaveType = z.object({
    type: z.literal('webp'),
    quality: z.number().int().min(1).max(100),
})
const AvifImageSaveType = z.object({
    type: z.literal('avif'),
    quality: z.number().int().min(1).max(100),
})

export const ImageSaveType = z.discriminatedUnion('type', [
    PngImageSaveType,
    WebpImageSaveType,
    AvifImageSaveType,
])
export type ImageSaveType = z.infer<typeof ImageSaveType>

export const ImageSettings = z.object({
    sourceType: ImageSaveType,
    thumbnailType: ImageSaveType,
    thumbnailSize: z.number().int().min(16).max(2048),
})
export type ImageSettings = z.infer<typeof ImageSettings>

export const DebugSettings = z.object({
    enabled: z.boolean(),
    recentRequestLimit: z.number().int().min(1).max(500),
})
export type DebugSettings = z.infer<typeof DebugSettings>

export const NovelAIMode = z.enum(['live', 'mock', 'fail'])
export type NovelAIMode = z.infer<typeof NovelAIMode>

/** Stored global settings. The NovelAI API key lives in a separate secrets table. */
export const GlobalSettings = z.object({
    globalVariables: PromptVariable,
    image: ImageSettings,
    debug: DebugSettings,
    novelai: z.object({ mode: NovelAIMode }),
})
export type GlobalSettings = z.infer<typeof GlobalSettings>

export const SETTINGS_SECTIONS = ['globalVariables', 'image', 'debug', 'novelai'] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

/** What `GET /settings` returns: stored settings plus derived, non-secret facts. */
export const SettingsView = GlobalSettings.extend({
    novelai: z.object({
        mode: NovelAIMode,
        hasApiKey: z.boolean(),
        /** Masked hint such as `****abcd`; never the key itself. */
        keyHint: z.string().nullable(),
    }),
    export: z.object({ serverExportEnabled: z.boolean() }),
    updatedAt: IsoDateTime,
})
export type SettingsView = z.infer<typeof SettingsView>

export const NovelAIAccountStatus = z.object({
    mode: NovelAIMode,
    configured: z.boolean(),
    unlimited: z.boolean(),
    anlas: z.number().int().nonnegative().nullable(),
    error: z.string().nullable(),
    updatedAt: IsoDateTime,
})
export type NovelAIAccountStatus = z.infer<typeof NovelAIAccountStatus>
