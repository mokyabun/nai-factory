import * as z from 'zod'

import { CharacterPrompt, ParametersPatch, PromptVariable } from '../schemas/common'
import { MAX_IMAGES_PER_JOB } from '../schemas/job'

export const ProjectListQuery = z.object({
    /** A group id, or `none` for ungrouped projects. Omit for every project. */
    groupId: z.union([z.coerce.number().int().positive(), z.literal('none')]).optional(),
})
export type ProjectListQuery = z.infer<typeof ProjectListQuery>

export const ProjectCreateBody = z.object({
    groupId: z.number().int().positive().nullable(),
    name: z.string().trim().min(1),
})
export type ProjectCreateBody = z.infer<typeof ProjectCreateBody>

export const ProjectSettingsPatch = z.object({
    slideshowImageCount: z.number().int().min(1).max(10).optional(),
    sceneCardSize: z.enum(['sm', 'md', 'lg']).optional(),
    outputTemplate: z.string().min(1).optional(),
    defaultImageCount: z.number().int().min(1).max(MAX_IMAGES_PER_JOB).optional(),
})
export type ProjectSettingsPatch = z.infer<typeof ProjectSettingsPatch>

export const ProjectPatch = z.object({
    groupId: z.number().int().positive().nullable().optional(),
    name: z.string().trim().min(1).optional(),
    prompt: z.string().optional(),
    negativePrompt: z.string().optional(),
    variables: PromptVariable.optional(),
    parameters: ParametersPatch.optional(),
    characterPrompts: z.array(CharacterPrompt).optional(),
    settings: ProjectSettingsPatch.optional(),
})
export type ProjectPatch = z.infer<typeof ProjectPatch>

export const ProjectDuplicateBody = z.object({
    scenes: z.boolean().optional(),
    references: z.boolean().optional(),
})
export type ProjectDuplicateBody = z.infer<typeof ProjectDuplicateBody>

export const ProjectExportBody = z.object({
    imageCount: z.number().int().min(1).max(500),
    outputTemplate: z.string().min(1).optional(),
})
export type ProjectExportBody = z.infer<typeof ProjectExportBody>

/** Folder names below `NAI_FACTORY_EXPORT_DIR`; path separators and `..` are rejected. */
export const ExportFolderName = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[\w\- .]+$/, 'Only letters, digits, spaces, `-`, `_` and `.` are allowed')
    .refine((value) => value !== '.' && value !== '..' && !value.includes('..'), {
        message: '`..` is not allowed',
    })

export const ProjectServerExportBody = ProjectExportBody.extend({ folder: ExportFolderName })
export type ProjectServerExportBody = z.infer<typeof ProjectServerExportBody>
