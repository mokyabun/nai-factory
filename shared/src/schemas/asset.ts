import * as z from 'zod'

export const ASSET_KINDS = [
    'image',
    'image_thumb',
    'playground_image',
    'playground_thumb',
    'char_ref_source',
    'char_ref_thumb',
    'char_ref_processed',
    'vibe_source',
    'vibe_encoded',
] as const

export const AssetKind = z.enum(ASSET_KINDS)
export type AssetKind = z.infer<typeof AssetKind>
