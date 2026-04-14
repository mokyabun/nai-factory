import { Elysia } from 'elysia'
import { domainEvents } from '@/services/events'
import { queueManager } from '@/services/queue-manager'
import { QueueModel } from './model'
import * as service from './service'

export const queue = new Elysia({ prefix: '/queue' })
    .get('/', ({ query }) => service.get(query.projectId), {
        query: QueueModel.listQuery,
    })
    .get('/status', () => queueManager.status())
    .post(
        '/enqueue',
        async ({ body }) => {
            const item = await queueManager.add(body.sceneId, body.position ?? 'back')
            domainEvents.invalidate('queue')
            return item
        },
        { body: QueueModel.enqueueBody },
    )
    .post(
        '/enqueue-all',
        async ({ body }) => {
            const items = await service.enqueueAll(body.projectId, body.position ?? 'back')
            domainEvents.invalidate('queue')
            return items
        },
        { body: QueueModel.enqueueAllBody },
    )
    .post(
        '/enqueue-bulk',
        async ({ body }) => {
            const items = await service.enqueueBulk(body.sceneIds, body.position ?? 'back')
            domainEvents.invalidate('queue')
            return items
        },
        { body: QueueModel.enqueueBulkBody },
    )
    .post('/start', () => {
        queueManager.start()
        domainEvents.invalidate('queue')
        return queueManager.status()
    })
    .post('/stop', () => {
        queueManager.stop()
        domainEvents.invalidate('queue')
        return queueManager.status()
    })
    .delete(
        '/',
        async ({ query }) => {
            const result = await service.clearAll(query.sceneId)
            domainEvents.invalidate('queue')
            return result
        },
        { query: QueueModel.clearQuery },
    )
    .delete(
        '/:id',
        async ({ params }) => {
            const result = await service.cancel(params.id)
            domainEvents.invalidate('queue')
            return result
        },
        { params: QueueModel.getParams },
    )
