import * as z from 'zod'

const PngImageSaveType = z.object({ type: z.literal('png') })
const WebpImageSaveType = z.object({
    type: z.literal('webp'),
    quality: z.number().min(1).max(100),
})
const AVIFImageSaveType = z.object({
    type: z.literal('avif'),
    quality: z.number().min(1).max(100),
})

export type ImageSaveType = z.infer<typeof ImageSaveType>
export const ImageSaveType = z.union([PngImageSaveType, WebpImageSaveType, AVIFImageSaveType])

export type ImageSettings = z.infer<typeof ImageSettings>
export const ImageSettings = z.object({
    sourceType: ImageSaveType,
    thumbnailType: ImageSaveType,
    thumbnailSize: z.number().min(1),
})

export type DebugSettings = z.infer<typeof DebugSettings>
export const DebugSettings = z.object({
    enabled: z.boolean(),
    recentRequestLimit: z.number().int().min(1).max(500),
})

export type ExportSettings = z.infer<typeof ExportSettings>
export const ExportSettings = z.object({
    serverPath: z.string(),
})

export type NovelAISettings = z.infer<typeof NovelAISettings>
export const NovelAISettings = z.object({
    apiKey: z.string(),
})

export type GlobalSettings = z.infer<typeof GlobalSettings>
export const GlobalSettings = z.object({
    globalVariables: z.record(z.string(), z.string()),
    novelai: NovelAISettings,
    image: ImageSettings,
    debug: DebugSettings,
    export: ExportSettings,
})
