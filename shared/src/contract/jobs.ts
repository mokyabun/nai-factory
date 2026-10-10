import * as z from 'zod'

import { IdParams, MoveBody } from '../inputs/common'
import {
    JobClearQuery,
    JobHistoryQuery,
    JobListQuery,
    PlaygroundEnqueueBody,
    SceneEnqueueBody,
} from '../inputs/jobs'
import { ClearJobsResult, EnqueueResult, Job, QueueStatus } from '../schemas/job'
import { endpoint } from './define'

export const jobs = {
    list: endpoint({
        method: 'GET',
        path: '/jobs',
        query: JobListQuery,
        response: z.array(Job),
    }),
    history: endpoint({
        method: 'GET',
        path: '/jobs/history',
        query: JobHistoryQuery,
        response: z.array(Job),
    }),
    status: endpoint({ method: 'GET', path: '/jobs/status', response: QueueStatus }),
    enqueueScenes: endpoint({
        method: 'POST',
        path: '/jobs/scene',
        body: SceneEnqueueBody,
        response: EnqueueResult,
        status: 201,
    }),
    enqueuePlayground: endpoint({
        method: 'POST',
        path: '/jobs/playground',
        body: PlaygroundEnqueueBody,
        response: EnqueueResult,
        status: 201,
    }),
    start: endpoint({ method: 'POST', path: '/jobs/start', response: QueueStatus }),
    stop: endpoint({ method: 'POST', path: '/jobs/stop', response: QueueStatus }),
    move: endpoint({
        method: 'PATCH',
        path: '/jobs/:id/position',
        params: IdParams,
        body: MoveBody,
        response: Job,
    }),
    retry: endpoint({
        method: 'POST',
        path: '/jobs/:id/retry',
        params: IdParams,
        response: Job,
    }),
    delete: endpoint({ method: 'DELETE', path: '/jobs/:id', params: IdParams, response: null }),
    clear: endpoint({
        method: 'DELETE',
        path: '/jobs',
        query: JobClearQuery,
        response: ClearJobsResult,
    }),
}
