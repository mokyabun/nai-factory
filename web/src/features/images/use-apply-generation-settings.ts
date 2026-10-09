import type { PlaygroundState, Project } from '@nai-factory/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { call, contract } from '@/lib/api'
import { qk, queries } from '@/lib/queries'

import {
    applyGenerationParameters,
    type GenerationSettings,
    type SeedMode,
} from './generation-settings'

type ApplyRequest = {
    settings: GenerationSettings
    seedMode: SeedMode
}

/** Open editors pick the change up from the query cache like any other server update. */
export function useApplyGenerationSettings() {
    const queryClient = useQueryClient()

    const toPlayground = useMutation({
        mutationFn: async ({ settings, seedMode }: ApplyRequest) => {
            const current = await queryClient.ensureQueryData(queries.playground.state())
            return call(contract.playground.updateState, {
                body: {
                    prompt: settings.prompt ?? current.prompt,
                    negativePrompt: settings.negativePrompt ?? current.negativePrompt,
                    characterPrompts: settings.characterPrompts ?? current.characterPrompts,
                    parameters: applyGenerationParameters(current.parameters, settings, seedMode),
                },
            })
        },
        onSuccess: (data) => {
            queryClient.setQueryData<PlaygroundState>(qk.playground.state(), data)
        },
    })

    const toProject = useMutation({
        mutationFn: async ({
            projectId,
            settings,
            seedMode,
        }: ApplyRequest & { projectId: number }) => {
            const current = await queryClient.ensureQueryData(queries.projects.get(projectId))

            // Only parameters: the project prompt is a template, while metadata holds its output.
            return call(contract.projects.update, {
                params: { id: projectId },
                body: {
                    parameters: applyGenerationParameters(current.parameters, settings, seedMode),
                },
            })
        },
        onSuccess: (data, { projectId }) => {
            queryClient.setQueryData<Project>(qk.projects.get(projectId), data)
        },
    })

    return { toPlayground, toProject }
}
