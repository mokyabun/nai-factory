import * as z from 'zod'
import { CharacterPrompt, Parameters } from '../app'

export const Project = z.object({
    id: z.number(),
    groupId: z.number().nullable(),

    name: z.string(),
    prompt: z.string(),
    negativePrompt: z.string(),

    variables: z.record(z.string(), z.string()),
    parameters: Parameters,
    characterPrompts: z.array(CharacterPrompt),

    createdAt: z.string(),
    updatedAt: z.string(),
})

export const ProjectGetQuery = z.object({
    groupId: z
        .union([z.coerce.number().int().positive(), z.literal('null'), z.literal('ungrouped')])
        .optional(),
})

export const ProjectPostBody = z.object({
    groupId: z.number().int().positive().nullable(),
    name: z.string().min(1),
})

export const ProjectPatchBody = z.object({
    groupId: z.number().int().positive().nullable().optional(),
    name: z.string().min(1).optional(),
    prompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    variables: z.record(z.string(), z.string()).optional(),
    parameters: Parameters.optional(),
    characterPrompts: z.array(CharacterPrompt).optional(),
})

export const ProjectListQuery = ProjectGetQuery
export const CreateProjectBody = ProjectPostBody
export const UpdateProjectBody = ProjectPatchBody

export type Project = z.infer<typeof Project>
export type ProjectGetQuery = z.infer<typeof ProjectGetQuery>
export type ProjectPostBody = z.infer<typeof ProjectPostBody>
export type ProjectPatchBody = z.infer<typeof ProjectPatchBody>
export type ProjectListQuery = ProjectGetQuery
export type CreateProjectBody = ProjectPostBody
export type UpdateProjectBody = ProjectPatchBody
