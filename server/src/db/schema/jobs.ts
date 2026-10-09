import type { JobErrorKind, JobKind, JobStatus, PlaygroundJobPayload } from '@nai-factory/shared'
import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createdAt } from '../columns'
import { projects, scenes, sceneVariations } from './projects'

/** Scene jobs compile the latest scene data when they run; playground jobs store a snapshot. */
export const jobs = sqliteTable(
    'jobs',
    {
        id: integer('id').primaryKey(),
        kind: text('kind').notNull().$type<JobKind>(),
        status: text('status').notNull().$type<JobStatus>(),
        priorityKey: text('priority_key').notNull(),
        projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
        sceneId: integer('scene_id').references(() => scenes.id, { onDelete: 'cascade' }),
        variationId: integer('variation_id').references(() => sceneVariations.id, {
            onDelete: 'cascade',
        }),
        payload: text('payload', { mode: 'json' }).$type<PlaygroundJobPayload>(),
        /** Images to generate per compiled prompt. */
        repeatCount: integer('repeat_count').notNull().default(1),
        totalImages: integer('total_images'),
        doneImages: integer('done_images').notNull().default(0),
        error: text('error'),
        errorKind: text('error_kind').$type<JobErrorKind>(),
        createdAt: createdAt(),
        startedAt: integer('started_at', { mode: 'timestamp_ms' }),
        finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
    },
    (t) => [
        index('jobs_status_priority_key_id_idx').on(t.status, t.priorityKey, t.id),
        index('jobs_project_id_idx').on(t.projectId),
        index('jobs_scene_id_idx').on(t.sceneId),
        index('jobs_variation_id_idx').on(t.variationId),
        check(
            'jobs_kind_check',
            sql`(${t.kind} = 'scene' AND ${t.sceneId} IS NOT NULL AND ${t.variationId} IS NOT NULL) OR (${t.kind} = 'playground' AND ${t.payload} IS NOT NULL)`,
        ),
    ],
)
