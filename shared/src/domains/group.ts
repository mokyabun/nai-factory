import * as z from 'zod'
import { Project } from './project'

export const Group = z.object({
    id: z.number(),

    name: z.string(),

    createdAt: z.string(),
    updatedAt: z.string(),
})

export const GroupPostBody = z.object({
    name: z.string().min(1),
})

export const GroupPatchBody = z.object({
    name: z.string().min(1).optional(),
})

export const GroupProjectSummary = Project.pick({
    id: true,
    groupId: true,
    name: true,
})

export const GroupWithProjects = Group.extend({
    type: z.literal('group'),
    projects: z.array(GroupProjectSummary),
})

export const UngroupedProjects = z.object({
    type: z.literal('ungrouped'),
    id: z.null(),
    name: z.string(),
    projects: z.array(GroupProjectSummary),
})

export const GroupListItem = z.discriminatedUnion('type', [GroupWithProjects, UngroupedProjects])

export const CreateGroupBody = GroupPostBody
export const UpdateGroupBody = GroupPatchBody

export type Group = z.infer<typeof Group>
export type GroupPostBody = z.infer<typeof GroupPostBody>
export type GroupPatchBody = z.infer<typeof GroupPatchBody>
export type GroupProjectSummary = z.infer<typeof GroupProjectSummary>
export type GroupWithProjects = z.infer<typeof GroupWithProjects>
export type UngroupedProjects = z.infer<typeof UngroupedProjects>
export type GroupListItem = z.infer<typeof GroupListItem>
export type CreateGroupBody = GroupPostBody
export type UpdateGroupBody = GroupPatchBody
