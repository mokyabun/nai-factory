import * as z from 'zod'
import { Project } from './project'

export const Group = z.object({
    id: z.number(),
    parentGroupId: z.number().nullable(),

    name: z.string(),

    createdAt: z.string(),
    updatedAt: z.string(),
})

export const GroupPostBody = z.object({
    parentGroupId: z.number().int().positive().nullable().optional(),
    name: z.string().min(1),
})

export const GroupPatchBody = z.object({
    parentGroupId: z.number().int().positive().nullable().optional(),
    name: z.string().min(1).optional(),
})

export const GroupProjectSummary = Project.pick({
    id: true,
    groupId: true,
    name: true,
})

export type GroupWithProjects = Group & {
    type: 'group'
    projects: GroupProjectSummary[]
    groups: GroupWithProjects[]
}

export const GroupWithProjects: z.ZodType<GroupWithProjects> = Group.extend({
    type: z.literal('group'),
    projects: z.array(GroupProjectSummary),
    groups: z.lazy(() => z.array(GroupWithProjects)),
})

export const UngroupedProjects = z.object({
    type: z.literal('ungrouped'),
    id: z.null(),
    name: z.string(),
    projects: z.array(GroupProjectSummary),
})

export const GroupListItem: z.ZodType<GroupWithProjects | UngroupedProjects> = z.union([
    GroupWithProjects,
    UngroupedProjects,
])

export type Group = z.infer<typeof Group>
export type GroupPostBody = z.infer<typeof GroupPostBody>
export type GroupPatchBody = z.infer<typeof GroupPatchBody>
export type GroupProjectSummary = z.infer<typeof GroupProjectSummary>
export type UngroupedProjects = z.infer<typeof UngroupedProjects>
export type GroupListItem = GroupWithProjects | UngroupedProjects
