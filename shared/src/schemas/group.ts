import * as z from 'zod'

import { IsoDateTime } from './common'

export const Group = z.object({
    id: z.number(),
    parentId: z.number().nullable(),
    name: z.string(),
    createdAt: IsoDateTime,
    updatedAt: IsoDateTime,
})
export type Group = z.infer<typeof Group>

export const ProjectSummary = z.object({
    id: z.number(),
    groupId: z.number().nullable(),
    name: z.string(),
})
export type ProjectSummary = z.infer<typeof ProjectSummary>

export type GroupNode = Group & {
    type: 'group'
    projects: ProjectSummary[]
    groups: GroupNode[]
}

export const GroupNode: z.ZodType<GroupNode> = Group.extend({
    type: z.literal('group'),
    projects: z.array(ProjectSummary),
    get groups() {
        return z.array(GroupNode)
    },
})

export const UngroupedProjects = z.object({
    type: z.literal('ungrouped'),
    id: z.null(),
    name: z.string(),
    projects: z.array(ProjectSummary),
})
export type UngroupedProjects = z.infer<typeof UngroupedProjects>

export const GroupTreeItem = z.union([GroupNode, UngroupedProjects])
export type GroupTreeItem = GroupNode | UngroupedProjects
