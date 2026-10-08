import { contract } from '@nai-factory/shared'
import { zipSync } from 'fflate'
import sharp from 'sharp'

import type { TestApp } from './app'

export async function pngBytes(width = 64, height = 64, color = { r: 200, g: 50, b: 50 }) {
    return new Uint8Array(
        await sharp({ create: { width, height, channels: 3, background: color } })
            .png()
            .toBuffer(),
    )
}

export async function pngFile(name = 'ref.png') {
    return new File([await pngBytes()], name, { type: 'image/png' })
}

/** A NovelAI generate-image response: a zip with one PNG. */
export async function novelaiZip() {
    return zipSync({ 'image_0.png': await pngBytes() })
}

export async function createProject(t: TestApp, name = 'project') {
    return t.call(contract.projects.create, { body: { groupId: null, name } })
}

/** A project with one scene and the given variation values for `<<pose>>`. */
export async function createScene(
    t: TestApp,
    options: { projectId?: number; name?: string; poses?: string[]; prompt?: string } = {},
) {
    const projectId = options.projectId ?? (await createProject(t)).id
    if (options.prompt !== undefined) {
        await t.call(contract.projects.update, {
            params: { id: projectId },
            body: { prompt: options.prompt },
        })
    }
    const scene = await t.call(contract.scenes.create, {
        body: { projectId, name: options.name ?? 'scene' },
    })
    const updated = await t.call(contract.scenes.update, {
        params: { id: scene.id },
        body: {
            variations: (options.poses ?? ['standing']).map((pose) => ({
                variables: [{ key: 'pose', value: pose }],
            })),
        },
    })
    return { projectId, scene: updated }
}

/** Starts the queue and waits until it stops. */
export async function runQueue(t: TestApp) {
    await t.call(contract.jobs.start)
    await t.ctx.scheduler.idle()
}

export async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs
    while (!(await check())) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for condition')
        await new Promise((resolve) => setTimeout(resolve, 5))
    }
}

/** A promise with its resolver, to hold a fake NovelAI response until the test releases it. */
export function deferred<T = void>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((r) => (resolve = r))
    return { promise, resolve }
}
