import { t } from 'elysia'

const PngImageSaveType = t.Object({ type: t.Literal('png') })
const WebpImageSaveType = t.Object({
    type: t.Literal('webp'),
    quality: t.Number({ minimum: 1, maximum: 100 }),
})
const AVIFImageSaveType = t.Object({
    type: t.Literal('avif'),
    quality: t.Number({ minimum: 1, maximum: 100 }),
})

export type ImageSaveType = typeof ImageSaveType.static
export const ImageSaveType = t.Union([PngImageSaveType, WebpImageSaveType, AVIFImageSaveType])

export type ImageSettings = typeof ImageSettings.static
export const ImageSettings = t.Object({
    sourceType: ImageSaveType,
    thumbnailType: ImageSaveType,
    thumbnailSize: t.Number({ minimum: 1 }),
})

export type NovelAISettings = typeof NovelAISettings.static
export const NovelAISettings = t.Object({
    apiKey: t.String(),
})

export type GlobalSettings = typeof GlobalSettings.static
export const GlobalSettings = t.Object({
    globalVariables: t.Record(t.String(), t.String()),
    novelai: NovelAISettings,
    image: ImageSettings,
})
