import type { PlaygroundState, Project } from '@nai-factory/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { call, contract } from '@/lib/api'
import { qk, queries } from '@/lib/queries'

import {
    type GenerationSettings,
    generationSettingsPatch,
    type SettingsSelection,
} from './generation-settings'

type ApplyRequest = {
    settings: GenerationSettings
    selection: SettingsSelection
}

/** Open editors pick the change up from the query cache like any other server update. */
export function useApplyGenerationSettings() {
    const queryClient = useQueryClient()

    const toPlayground = useMutation({
        mutationFn: async ({ settings, selection }: ApplyRequest) => {
            const current = await queryClient.ensureQueryData(queries.playground.state())
            return call(contract.playground.updateState, {
                body: generationSettingsPatch(current, settings, selection),
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
            selection,
        }: ApplyRequest & { projectId: number }) => {
            const current = await queryClient.ensureQueryData(queries.projects.get(projectId))
            return call(contract.projects.update, {
                params: { id: projectId },
                body: generationSettingsPatch(current, settings, selection),
            })
        },
        onSuccess: (data, { projectId }) => {
            queryClient.setQueryData<Project>(qk.projects.get(projectId), data)
        },
    })

    return { toPlayground, toProject }
}
