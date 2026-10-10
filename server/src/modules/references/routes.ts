import { contract } from '@nai-factory/shared'
import type { Hono } from 'hono'

import type { AppContext, AppEnv } from '@/context'
import { route } from '@/lib/http'

import * as service from './service'

export function registerReferenceRoutes(app: Hono<AppEnv>, ctx: AppContext) {
    const { projects, vibeTransfers, characterReferences } = contract

    route(app, projects.vibeTransfers, ({ params }) => service.listVibes(ctx, params.id))
    route(app, projects.uploadVibeTransfer, ({ params, body }) =>
        service.uploadVibe(ctx, params.id, body.image),
    )
    route(app, vibeTransfers.update, ({ params, body }) => service.updateVibe(ctx, params.id, body))
    route(app, vibeTransfers.move, ({ params, body }) => service.moveVibe(ctx, params.id, body))
    route(app, vibeTransfers.delete, ({ params }) => service.removeVibe(ctx, params.id))

    route(app, projects.characterReferences, ({ params }) => service.listCharRefs(ctx, params.id))
    route(app, projects.uploadCharacterReference, ({ params, body }) =>
        service.uploadCharRef(ctx, params.id, body.image),
    )
    route(app, characterReferences.update, ({ params, body }) =>
        service.updateCharRef(ctx, params.id, body),
    )
    route(app, characterReferences.move, ({ params, body }) =>
        service.moveCharRef(ctx, params.id, body),
    )
    route(app, characterReferences.delete, ({ params }) => service.removeCharRef(ctx, params.id))
}
