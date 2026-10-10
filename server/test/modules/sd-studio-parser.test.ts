import { describe, expect, it } from 'bun:test'

import { parseSdStudioFile } from '@/modules/sd-studio/parser'

describe('SD Studio import parser', () => {
    it('preserves source scene order for integer-like object keys when raw JSON text is provided', () => {
        const pack = parseSdStudioFile(`{
            "name": "ordered pack",
            "scenes": {
                "10": {
                    "name": "scene ten",
                    "slots": [[{ "prompt": "ten", "enabled": true }]]
                },
                "2": {
                    "name": "scene two",
                    "slots": [[{ "prompt": "two", "enabled": true }]]
                },
                "1": {
                    "name": "scene one",
                    "slots": [[{ "prompt": "one", "enabled": true }]]
                }
            }
        }`)

        expect(pack.scenes.map((scene) => scene.name)).toEqual([
            'scene ten',
            'scene two',
            'scene one',
        ])
    })
})
