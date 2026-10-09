import { afterAll, describe, expect, it } from 'bun:test'

import { contract } from '@nai-factory/shared'

import { jobs as jobsTable } from '@/db'
import type { FetchLike } from '@/integrations/novelai/client'
import type { NovelAIGenerateRequest } from '@/integrations/novelai/request'

import { createTestApp, type TestApp } from '../helpers/app'
import { createScene, deferred, novelaiZip, runQueue } from '../helpers/fixtures'

type Handler = (url: string, init: RequestInit) => Promise<Response>

/** A live-mode app whose NovelAI requests are answered by `handler`. */
async function liveApp(handler: Handler) {
    const fetch: FetchLike = (url, init) => handler(url, init)
    const t = await createTestApp({
        novelaiFetch: fetch,
        env: { NAI_FACTORY_NOVELAI_MODE: 'live' },
    })
    t.ctx.settings.setApiKey('pst-test')
    return t
}

async function imageResponse() {
    return new Response(await novelaiZip())
}

function requestedBody(init: RequestInit) {
    // The multipart body carries the JSON request as its last part.
    const text = Buffer.from(init.body as Uint8Array).toString('utf8')
    const json = text.slice(text.indexOf('{"action"'), text.lastIndexOf('}') + 1)
    return JSON.parse(json) as NovelAIGenerateRequest
}

function requestedPrompt(init: RequestInit) {
    return requestedBody(init).input
}

async function jobsOf(t: TestApp) {
    return t.ctx.db.select().from(jobsTable).all()
}

const apps: TestApp[] = []
afterAll(async () => {
    for (const app of apps) await app.close()
})

async function track<T extends TestApp>(app: Promise<T>) {
    const t = await app
    apps.push(t)
    return t
}

describe('D4: queued scene jobs use the latest prompt', () => {
    it('applies prompt edits made after enqueueing', async () => {
        const prompts: string[] = []
        const t = await track(
            liveApp(async (_, init) => {
                prompts.push(requestedPrompt(init))
                return imageResponse()
            }),
        )
        const { projectId, scene } = await createScene(t, { prompt: 'old <<pose>>' })
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        await t.call(contract.projects.update, {
            params: { id: projectId },
            body: { prompt: 'new <<pose>>' },
        })
        await runQueue(t)

        expect(prompts).toEqual(['new standing'])
        const [image] = await t.call(contract.images.list, { query: { sceneId: scene.id } })
        expect(image?.metadata.prompt).toBe('new standing')
    })

    it('applies variable edits to the remaining images of a running job', async () => {
        const prompts: string[] = []
        const firstImage = deferred()
        const release = deferred()
        const t = await track(
            liveApp(async (_, init) => {
                prompts.push(requestedPrompt(init))
                if (prompts.length === 1) {
                    firstImage.resolve()
                    await release.promise
                }
                return imageResponse()
            }),
        )
        const { scene } = await createScene(t, { prompt: '<<pose>>', poses: ['sitting'] })
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id], count: 3 } })
        await t.call(contract.jobs.start)
        await firstImage.promise

        await t.call(contract.scenes.update, {
            params: { id: scene.id },
            body: {
                variations: [
                    { id: scene.variations[0]!.id, variables: [{ key: 'pose', value: 'running' }] },
                ],
            },
        })
        release.resolve()
        await t.ctx.scheduler.idle()

        expect(prompts).toEqual(['sitting', 'running', 'running'])
    })
})

describe('C1: retrying a failed job resumes it', () => {
    it('generates only the remaining images', async () => {
        let calls = 0
        const t = await track(
            liveApp(async () => {
                calls += 1
                if (calls === 2) return new Response('bad', { status: 400 })
                return imageResponse()
            }),
        )
        const { scene } = await createScene(t)
        const { jobIds } = await t.call(contract.jobs.enqueueScenes, {
            body: { sceneIds: [scene.id], count: 3 },
        })
        await runQueue(t)

        const failed = (await t.call(contract.jobs.history)).find((job) => job.id === jobIds[0])
        expect(failed).toMatchObject({
            status: 'failed',
            doneImages: 1,
            totalImages: 3,
            errorKind: 'runtime',
        })
        expect(t.ctx.scheduler.state()).toMatchObject({ running: false, pauseReason: 'failure' })

        await t.call(contract.jobs.retry, { params: { id: jobIds[0]! } })
        await runQueue(t)

        expect(calls).toBe(4)
        const images = await t.call(contract.images.list, { query: { sceneId: scene.id } })
        expect(images).toHaveLength(3)
        const [job] = await jobsOf(t)
        expect(job).toMatchObject({ status: 'completed', doneImages: 3 })
    })
})

describe('C2: cancelling and deleting while running', () => {
    it('aborts the NovelAI request and marks the job cancelled', async () => {
        const started = deferred()
        let aborted = false
        const t = await track(
            liveApp(
                (_, init) =>
                    new Promise<Response>((_resolve, reject) => {
                        started.resolve()
                        init.signal?.addEventListener('abort', () => {
                            aborted = true
                            reject(new DOMException('aborted', 'AbortError'))
                        })
                    }),
            ),
        )
        const { scene } = await createScene(t)
        const { jobIds } = await t.call(contract.jobs.enqueueScenes, {
            body: { sceneIds: [scene.id] },
        })
        await t.call(contract.jobs.start)
        await started.promise

        await t.call(contract.jobs.delete, { params: { id: jobIds[0]! } })
        await t.ctx.scheduler.idle()

        expect(aborted).toBe(true)
        const [job] = await jobsOf(t)
        expect(job?.status).toBe('cancelled')
        expect((await t.call(contract.jobs.status)).pauseReason).toBeNull()
    })

    it('does not pause the queue when the running scene is deleted', async () => {
        const started = deferred()
        const release = deferred()
        const t = await track(
            liveApp(async () => {
                started.resolve()
                await release.promise
                return imageResponse()
            }),
        )
        const { projectId, scene } = await createScene(t)
        const other = await createScene(t, { projectId, name: 'other' })
        await t.call(contract.jobs.enqueueScenes, {
            body: { sceneIds: [scene.id, other.scene.id] },
        })
        await t.call(contract.jobs.start)
        await started.promise

        await t.call(contract.scenes.delete, { params: { id: scene.id } })
        release.resolve()
        await t.ctx.scheduler.idle()

        const status = await t.call(contract.jobs.status)
        expect(status.pauseReason).toBeNull()
        expect(status.failedCount).toBe(0)
        expect(
            await t.call(contract.images.list, { query: { sceneId: other.scene.id } }),
        ).toHaveLength(1)
    })
})

describe('C5: jobs queued while the loop finishes still run', () => {
    it('runs a job enqueued during the last job', async () => {
        let enqueueLate: (() => Promise<unknown>) | null = null
        const t = await track(
            liveApp(async () => {
                // Queue another job while the last one is still generating.
                const pending = enqueueLate
                enqueueLate = null
                await pending?.()
                return imageResponse()
            }),
        )
        const { projectId, scene } = await createScene(t)
        const late = await createScene(t, { projectId, name: 'late' })
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        enqueueLate = () =>
            t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [late.scene.id] } })

        await runQueue(t)

        expect(
            await t.call(contract.images.list, { query: { sceneId: late.scene.id } }),
        ).toHaveLength(1)
        expect(await t.call(contract.jobs.list)).toEqual([])
    })

    it('starts a job enqueued while the queue is running and idle-waiting', async () => {
        const t = await track(createTestApp())
        const { scene } = await createScene(t)
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        await t.call(contract.jobs.start)
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        await t.ctx.scheduler.idle()
        expect(await t.call(contract.images.list, { query: { sceneId: scene.id } })).toHaveLength(2)
    })
})

describe('B5: NovelAI retries', () => {
    it('retries 429 responses and then succeeds', async () => {
        let calls = 0
        const t = await track(
            liveApp(async () => {
                calls += 1
                if (calls <= 2)
                    return new Response('slow down', {
                        status: 429,
                        headers: { 'retry-after': '0' },
                    })
                return imageResponse()
            }),
        )
        const { scene } = await createScene(t)
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        await runQueue(t)

        expect(calls).toBe(3)
        expect(await t.call(contract.images.list, { query: { sceneId: scene.id } })).toHaveLength(1)
    })

    it('does not retry timeouts', async () => {
        let calls = 0
        const fetch: FetchLike = (_, init) =>
            new Promise((_resolve, reject) => {
                calls += 1
                init.signal?.addEventListener('abort', () =>
                    reject(new DOMException('timeout', 'TimeoutError')),
                )
            })
        const t = await track(
            createTestApp({
                novelaiFetch: fetch,
                novelaiTimeouts: { generate: 50 },
                env: { NAI_FACTORY_NOVELAI_MODE: 'live' },
            }),
        )
        t.ctx.settings.setApiKey('pst-test')
        const { scene } = await createScene(t)
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        await runQueue(t)

        expect(calls).toBe(1)
        const [job] = await t.call(contract.jobs.history)
        expect(job).toMatchObject({ status: 'failed', errorKind: 'network' })
        expect(job?.error).toContain('timed out')
    })

    it('fails immediately on authentication errors', async () => {
        let calls = 0
        const t = await track(
            liveApp(async () => {
                calls += 1
                return new Response('{"message":"Unauthorized"}', { status: 401 })
            }),
        )
        const { scene } = await createScene(t)
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        await runQueue(t)
        expect(calls).toBe(1)
        expect((await t.call(contract.jobs.history))[0]).toMatchObject({ errorKind: 'auth' })
    })
})

describe('queue management', () => {
    it('requeues jobs left running by a crash', async () => {
        const t = await track(createTestApp())
        const { scene } = await createScene(t)
        const { jobIds } = await t.call(contract.jobs.enqueueScenes, {
            body: { sceneIds: [scene.id] },
        })
        t.ctx.db.update(jobsTable).set({ status: 'running' }).run()
        t.ctx.scheduler.recover()
        const [job] = await t.call(contract.jobs.list)
        expect(job).toMatchObject({ id: jobIds[0], status: 'queued' })
    })

    it('reorders queued jobs and inserts at the front', async () => {
        const t = await track(createTestApp())
        const { scene } = await createScene(t, { poses: ['a', 'b'] })
        const first = await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        const front = await t.call(contract.jobs.enqueueScenes, {
            body: { variationIds: [scene.variations[1]!.id], position: 'front' },
        })
        let list = await t.call(contract.jobs.list)
        expect(list.map((job) => job.id)).toEqual([...front.jobIds, ...first.jobIds])

        await t.call(contract.jobs.move, {
            params: { id: front.jobIds[0]! },
            body: { beforeId: first.jobIds[1]!, afterId: null },
        })
        list = await t.call(contract.jobs.list)
        expect(list.map((job) => job.id)).toEqual([...first.jobIds, ...front.jobIds])
    })

    it('snapshots the playground prompt with unsaved overrides', async () => {
        const t = await track(createTestApp())
        await t.call(contract.playground.updateState, { body: { prompt: 'saved' } })
        const { jobIds } = await t.call(contract.jobs.enqueuePlayground, {
            body: { prompt: 'unsaved' },
        })
        await t.call(contract.playground.updateState, { body: { prompt: 'changed later' } })
        const [job] = await t.call(contract.jobs.list)
        expect(job).toMatchObject({ id: jobIds[0], kind: 'playground', prompt: 'unsaved' })

        await runQueue(t)
        const [image] = await t.call(contract.playground.images)
        expect(image?.prompt).toBe('unsaved')
    })

    it('clears queued jobs of a scene', async () => {
        const t = await track(createTestApp())
        const { scene } = await createScene(t, { poses: ['a', 'b'] })
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        expect(await t.call(contract.jobs.clear, { query: { sceneId: scene.id } })).toEqual({
            cancelled: 2,
        })
        expect(await t.call(contract.jobs.list)).toEqual([])
    })

    it('stops after the current image when the user stops the queue', async () => {
        const started = deferred()
        const release = deferred()
        const t = await track(
            liveApp(async () => {
                started.resolve()
                await release.promise
                return imageResponse()
            }),
        )
        const { scene } = await createScene(t)
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id], count: 2 } })
        await t.call(contract.jobs.start)
        await started.promise
        expect((await t.call(contract.jobs.stop)).state).toBe('pausing')
        release.resolve()
        await t.ctx.scheduler.idle()

        const status = await t.call(contract.jobs.status)
        expect(status).toMatchObject({ state: 'paused', pauseReason: 'user', pendingCount: 1 })
        const [job] = await t.call(contract.jobs.list)
        expect(job).toMatchObject({ status: 'queued', doneImages: 1 })
    })
})

describe('references in live mode', () => {
    it('encodes vibes once and uploads references only while the cache is cold', async () => {
        const calls: { url: string; parts: string[] }[] = []
        const t = await track(
            liveApp(async (url, init) => {
                const text = Buffer.from(init.body as Uint8Array).toString('latin1')
                calls.push({
                    url,
                    parts: [...text.matchAll(/form-data; name="([^"]+)"/g)].map(
                        (m) => m[1] as string,
                    ),
                })
                if (url.endsWith('/ai/encode-vibe')) return new Response(new Uint8Array([1, 2, 3]))
                return imageResponse()
            }),
        )
        const { projectId, scene } = await createScene(t, { poses: ['a', 'b'] })
        const { pngFile } = await import('../helpers/fixtures')
        await t.call(contract.projects.uploadVibeTransfer, {
            params: { id: projectId },
            body: { image: await pngFile() },
        })
        await t.call(contract.projects.uploadCharacterReference, {
            params: { id: projectId },
            body: { image: await pngFile() },
        })
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        await runQueue(t)

        expect(calls.map((call) => call.url.replace(/^.*\/ai\//, ''))).toEqual([
            'encode-vibe',
            'generate-image',
            'generate-image',
        ])
        expect(calls[1]?.parts).toEqual(['director_ref_0', 'ref_multiple_0', 'request'])
        expect(calls[2]?.parts).toEqual(['request'])
        const [vibe] = await t.call(contract.projects.vibeTransfers, { params: { id: projectId } })
        expect(vibe?.encoded).toBe(true)
    })

    it('skips references for V5 models and refuses character references on V4', async () => {
        const t = await track(liveApp(async () => imageResponse()))
        const { projectId, scene } = await createScene(t)
        const { pngFile } = await import('../helpers/fixtures')
        await t.call(contract.projects.uploadCharacterReference, {
            params: { id: projectId },
            body: { image: await pngFile() },
        })

        await t.call(contract.projects.update, {
            params: { id: projectId },
            body: { parameters: { model: 'nai-diffusion-4-full' } },
        })
        await t.call(contract.jobs.enqueueScenes, { body: { sceneIds: [scene.id] } })
        await runQueue(t)
        expect((await t.call(contract.jobs.history))[0]).toMatchObject({
            status: 'failed',
            errorKind: 'config',
        })

        await t.call(contract.projects.update, {
            params: { id: projectId },
            body: { parameters: { model: 'nai-diffusion-5-full' } },
        })
        await t.call(contract.jobs.retry, {
            params: { id: (await t.call(contract.jobs.history))[0]!.id },
        })
        await runQueue(t)
        expect(await t.call(contract.images.list, { query: { sceneId: scene.id } })).toHaveLength(1)
    })
})

describe('image count when queueing', () => {
    it('stores the count as repeatCount of scene jobs', async () => {
        const t = await track(createTestApp())
        const first = await createScene(t, { poses: ['a', 'b'] })
        const second = await createScene(t, { projectId: first.projectId, poses: ['c'] })
        const third = await createScene(t, { projectId: first.projectId, poses: ['d', 'e'] })

        await t.call(contract.jobs.enqueueScenes, {
            body: { sceneIds: [first.scene.id, second.scene.id, third.scene.id], count: 4 },
        })

        const queued = await t.call(contract.jobs.list)
        expect(queued.map((job) => job.totalImages)).toEqual([4, 4, 4, 4, 4])
        expect((await jobsOf(t)).every((job) => job.repeatCount === 4)).toBe(true)
        const status = await t.call(contract.jobs.status)
        expect(status).toMatchObject({ pendingCount: 5, pendingImages: 20 })

        await runQueue(t)
        const images = await t.call(contract.images.list, { query: { sceneId: first.scene.id } })
        expect(images).toHaveLength(8)
        expect((await t.call(contract.jobs.status)).pendingImages).toBe(0)
    })

    it('stores the count as repeatCount of playground jobs', async () => {
        const t = await track(createTestApp())
        await t.call(contract.jobs.enqueuePlayground, { body: { prompt: 'cat', count: 3 } })

        const [job] = await jobsOf(t)
        expect(job).toMatchObject({ kind: 'playground', repeatCount: 3, totalImages: 3 })

        await runQueue(t)
        expect(await t.call(contract.playground.images)).toHaveLength(3)
    })
})

describe('playground character prompts', () => {
    it('sends every character caption and keeps them on the image', async () => {
        const requests: NovelAIGenerateRequest[] = []
        const t = await track(
            liveApp(async (_, init) => {
                requests.push(requestedBody(init))
                return imageResponse()
            }),
        )
        const characterPrompts = [
            { enabled: true, center: { x: 0.1, y: 0.5 }, prompt: 'girl', uc: '' },
            { enabled: true, center: { x: 0.9, y: 0.5 }, prompt: 'boy', uc: '' },
        ]
        await t.call(contract.playground.updateState, { body: { characterPrompts } })
        await t.call(contract.jobs.enqueuePlayground, {
            body: { prompt: 'park', parameters: { useCharacterPositions: true } },
        })
        await runQueue(t)

        const captions = requests[0]?.parameters.v4_prompt.caption.char_captions
        expect(captions).toEqual([
            { char_caption: 'girl', centers: [{ x: 0.1, y: 0.5 }] },
            { char_caption: 'boy', centers: [{ x: 0.9, y: 0.5 }] },
        ])
        const [image] = await t.call(contract.playground.images)
        expect(image?.characterPrompts).toEqual(characterPrompts)
        expect(image?.metadata.characterPrompts).toEqual(characterPrompts)
    })
})
