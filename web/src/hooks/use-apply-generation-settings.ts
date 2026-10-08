import type { PlaygroundState, Project } from '@nai-factory/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { call, contract } from '@/lib/api'
import {
    applyGenerationParameters,
    type GenerationSettings,
    type SeedMode,
} from '@/lib/generation-settings'
import { qk } from '@/lib/queries'

type ApplyRequest = {
    settings: GenerationSettings
    seedMode: SeedMode
}

/**
 * Writes settings recovered from an image to the server and the query cache. Open editors pick the
 * change up from the cache the same way they pick up any other server update.
 */
export function useApplyGenerationSettings() {
    const queryClient = useQueryClient()

    const toPlayground = useMutation({
        mutationFn: async ({ settings, seedMode }: ApplyRequest) => {
            const current = await queryClient.ensureQueryData({
                queryKey: qk.playground.state(),
                queryFn: () => call(contract.playground.state),
            })
            return call(contract.playground.updateState, {
                body: {
                    prompt: settings.prompt ?? current.prompt,
                    negativePrompt: settings.negativePrompt ?? current.negativePrompt,
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
            const current = await queryClient.ensureQueryData({
                queryKey: qk.projects.get(projectId),
                queryFn: () => call(contract.projects.get, { params: { id: projectId } }),
            })

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
