import * as z from 'zod'
import { CharacterPrompt, Parameters } from '../app'
import { ProjectIdParams } from './shared'

export { ProjectIdParams }

export const ProjectListQuery = z.object({
    groupId: z.coerce.number(),
})

export const CreateProjectBody = z.object({
    groupId: z.number().nullable(),
    name: z.string().min(1),
})

export const UpdateProjectBody = z.object({
    groupId: z.number().nullable().optional(),
    name: z.string().min(1).optional(),
    prompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    parameters: Parameters.optional(),
    variables: z.record(z.string(), z.string()).optional(),
    characterPrompts: z.array(CharacterPrompt).optional(),
})

export type ProjectListQuery = z.infer<typeof ProjectListQuery>
export type CreateProjectBody = z.infer<typeof CreateProjectBody>
export type UpdateProjectBody = z.infer<typeof UpdateProjectBody>
