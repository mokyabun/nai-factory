import { describe, expect, it } from 'bun:test'

import * as z from 'zod'

import {
    ArchiveExportBody,
    CharacterReferencePatch,
    DEFAULT_PROJECT_PARAMETERS,
    GroupPatch,
    MoveBody,
    Parameters,
    ParametersPatch,
    PlaygroundStatePatch,
    ProjectPatch,
    ProjectServerExportBody,
    ProjectSettings,
    ScenePatch,
    SettingsPatch,
    StashPatch,
    VibeTransferPatch,
    buildPath,
    contract,
} from '../src'

const PATCH_SCHEMAS = {
    ArchiveExportBody,
    CharacterReferencePatch,
    GroupPatch,
    ParametersPatch,
    PlaygroundStatePatch,
    ProjectPatch,
    ScenePatch,
    SettingsPatch,
    StashPatch,
    VibeTransferPatch,
}

describe('PATCH schemas', () => {
    for (const [name, schema] of Object.entries(PATCH_SCHEMAS)) {
        it(`${name} adds no defaults to an empty body`, () => {
            expect(schema.parse({})).toEqual({})
        })
    }

    it('keeps nested objects free of defaults', () => {
        expect(ProjectPatch.parse({ settings: {} })).toEqual({ settings: {} })
        expect(SettingsPatch.parse({ novelai: {}, image: {} })).toEqual({ novelai: {}, image: {} })
    })

    it('every PATCH endpoint body adds no defaults', () => {
        for (const group of Object.values(contract)) {
            for (const definition of Object.values(group)) {
                if (definition.method !== 'PATCH' || !definition.body) continue
                if (definition.body === MoveBody) continue
                expect(
                    (definition.body as z.ZodType).parse({}),
                    `${definition.method} ${definition.path}`,
                ).toEqual({})
            }
        }
    })
})

describe('Parameters', () => {
    const valid = DEFAULT_PROJECT_PARAMETERS

    it('accepts the defaults', () => {
        expect(Parameters.parse(valid)).toEqual(valid)
    })

    it.each([
        ['width not a multiple of 64', { width: 100 }],
        ['width below minimum', { width: 0 }],
        ['height above maximum', { height: 4096 }],
        ['too many pixels', { width: 2048, height: 2048 }],
        ['steps above 50', { steps: 51 }],
        ['steps below 1', { steps: 0 }],
        ['fractional steps', { steps: 1.5 }],
        ['guidance above 10', { promptGuidance: 11 }],
        ['rescale above 1', { promptGuidanceRescale: 1.5 }],
        ['negative seed', { seed: -1 }],
        ['seed above uint32', { seed: 4_294_967_296 }],
        ['unknown sampler', { sampler: 'euler' }],
    ])('rejects %s', (_, patch) => {
        expect(Parameters.safeParse({ ...valid, ...patch }).success).toBe(false)
    })

    it('accepts the largest allowed area', () => {
        expect(Parameters.safeParse({ ...valid, width: 2048, height: 1536 }).success).toBe(true)
    })
})

describe('ProjectSettings', () => {
    it('fills defaults when reading stored JSON', () => {
        expect(ProjectSettings.parse({ slideshowImageCount: 8 })).toEqual({
            slideshowImageCount: 8,
            sceneCardSize: 'md',
            outputTemplate: '{character}-{scene}-{number}.{extension}',
        })
    })
})

describe('server export folder', () => {
    const base = { imageCount: 1 }

    it.each(['../x', '..', 'a/b', 'a\\b', '/abs', ''])('rejects %p', (folder) => {
        expect(ProjectServerExportBody.safeParse({ ...base, folder }).success).toBe(false)
    })

    it('accepts a plain name', () => {
        expect(ProjectServerExportBody.parse({ ...base, folder: 'my export_1' }).folder).toBe(
            'my export_1',
        )
    })
})

describe('buildPath', () => {
    it('fills and encodes parameters', () => {
        expect(buildPath('/scenes/:id/position', { id: 5 })).toBe('/scenes/5/position')
        expect(buildPath('/x/:name', { name: 'a b' })).toBe('/x/a%20b')
    })

    it('throws on missing parameters', () => {
        expect(() => buildPath('/scenes/:id', {})).toThrow()
    })
})
