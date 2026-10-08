import {
    DEFAULT_PLAYGROUND_SETTINGS,
    type PlaygroundSettings,
    type Project,
} from '@nai-factory/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import {
    applyGenerationParameters,
    type GenerationSettings,
    type SeedMode,
} from '@/lib/generation-settings'
import { requireApiResult } from '@/lib/optimistic'
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
                queryKey: qk.playgroundSettings(),
                queryFn: async () => {
                    const { data } = await api.playground.settings.get()
                    return data ?? DEFAULT_PLAYGROUND_SETTINGS
                },
            })
            const { data } = await requireApiResult(
                api.playground.settings.patch({
                    prompt: settings.prompt ?? current.prompt,
                    negativePrompt: settings.negativePrompt ?? current.negativePrompt,
                    parameters: applyGenerationParameters(current.parameters, settings, seedMode),
                }),
            )
            return data
        },
        onSuccess: (data) => {
            if (data) queryClient.setQueryData<PlaygroundSettings>(qk.playgroundSettings(), data)
        },
    })

    const toProject = useMutation({
        mutationFn: async ({
            projectId,
            settings,
            seedMode,
        }: ApplyRequest & { projectId: number }) => {
            const current = await queryClient.ensureQueryData({
                queryKey: qk.project(projectId),
                queryFn: async () => {
                    const { data } = await api.projects({ projectId }).get()
                    return data ?? null
                },
            })
            if (!current) throw new Error('프로젝트를 찾을 수 없습니다')

            // Only parameters: the project prompt is a template, while metadata holds its output.
            const { data } = await requireApiResult(
                api.projects({ projectId }).patch({
                    parameters: applyGenerationParameters(current.parameters, settings, seedMode),
                }),
            )
            return data
        },
        onSuccess: (data, { projectId }) => {
            if (data) queryClient.setQueryData<Project | null>(qk.project(projectId), data)
        },
    })

    return { toPlayground, toProject }
}
