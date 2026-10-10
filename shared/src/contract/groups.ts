import * as z from 'zod'

import { IdParams } from '../inputs/common'
import { GroupCreateBody, GroupPatch } from '../inputs/groups'
import { Group, GroupNode, GroupTreeItem } from '../schemas/group'
import { endpoint } from './define'

export const groups = {
    tree: endpoint({ method: 'GET', path: '/groups', response: z.array(GroupTreeItem) }),
    get: endpoint({ method: 'GET', path: '/groups/:id', params: IdParams, response: GroupNode }),
    create: endpoint({
        method: 'POST',
        path: '/groups',
        body: GroupCreateBody,
        response: Group,
        status: 201,
    }),
    update: endpoint({
        method: 'PATCH',
        path: '/groups/:id',
        params: IdParams,
        body: GroupPatch,
        response: Group,
    }),
    delete: endpoint({ method: 'DELETE', path: '/groups/:id', params: IdParams, response: null }),
}
