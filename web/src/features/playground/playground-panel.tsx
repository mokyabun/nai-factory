import {
    type CharacterPrompt,
    DEFAULT_PLAYGROUND_PARAMETERS,
    type EnqueuePosition,
    type Parameters,
    type PlaygroundState,
    type PlaygroundStatePatch,
    type QueueStatus,
} from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useQueueStatus } from '@/features/queue/use-queue'
import { useAutosave } from '@/hooks/use-autosave'
import { call, contract } from '@/lib/api'
import { restoreSnapshots, snapshotQueries } from '@/lib/optimistic'
import { qk, queries } from '@/lib/queries'

import { PlaygroundEditor } from './playground-editor'
import { PlaygroundHeader } from './playground-header'

const DEFAULT_PLAYGROUND_STATE: PlaygroundState = {
    prompt: '',
    negativePrompt: '',
    characterPrompts: [],
    parameters: DEFAULT_PLAYGROUND_PARAMETERS,
    updatedAt: new Date(0).toISOString(),
}

type EnqueueRequest = {
    position: EnqueuePosition
    startNow: boolean
}

export function PlaygroundPanel() {
    const queryClient = useQueryClient()
    const settingsQuery = useQuery(queries.playground.state())

    const save = useCallback(
        async (patch: PlaygroundStatePatch) => {
            const data = await call(contract.playground.updateState, { body: patch })
            queryClient.setQueryData(qk.playground.state(), data)
        },
        [queryClient],
    )
    const draft = useAutosave<PlaygroundState, PlaygroundStatePatch>({
        data: settingsQuery.data,
        save,
    })
    const settings = draft.value ?? DEFAULT_PLAYGROUND_STATE

    const { status: queueStatus } = useQueueStatus()

    const enqueue = useMutation({
        mutationFn: async ({ position, startNow }: EnqueueRequest) => {
            try {
                // The current editor values go along, so unsaved edits are part of the snapshot.
                await call(contract.jobs.enqueuePlayground, {
                    body: {
                        prompt: settings.prompt,
                        negativePrompt: settings.negativePrompt,
                        characterPrompts: settings.characterPrompts,
                        parameters: settings.parameters,
                        position,
                    },
                })
            } catch (error) {
                throw new Error('대기열에 추가하지 못했습니다', { cause: error })
            }
            if (!startNow) return

            try {
                await call(contract.jobs.start)
            } catch (error) {
                throw new Error('대기열에는 추가했지만 생성을 시작하지 못했습니다', {
                    cause: error,
                })
            }
        },
        onMutate: async ({ startNow }) => {
            const snapshots = await snapshotQueries(queryClient, {
                queryKey: qk.jobs.all(),
            })
            queryClient.setQueryData<QueueStatus>(qk.jobs.status(), (status) =>
                status
                    ? {
                          ...status,
                          pendingCount: status.pendingCount + 1,
                          pendingImages: status.pendingImages + 1,
                          ...(startNow && {
                              pauseReason: null,
                              state: 'running' as const,
                          }),
                      }
                    : status,
            )
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            restoreSnapshots(queryClient, context?.snapshots)
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: qk.jobs.all() })
        },
    })

    function setField(key: 'prompt' | 'negativePrompt', value: string) {
        draft.update({ [key]: value })
    }

    function setCharacterPrompts(
        characterPrompts: CharacterPrompt[],
        options?: { immediate?: boolean },
    ) {
        draft.update({ characterPrompts }, options)
    }

    function setParameter<K extends keyof Parameters>(key: K, value: Parameters[K]) {
        draft.update({ parameters: { [key]: value } })
    }

    return (
        <div className="flex h-full min-h-0 flex-col bg-sidebar">
            <PlaygroundHeader
                isDisabled={!settings.prompt.trim() || enqueue.isPending}
                pendingAction={
                    enqueue.isPending ? (enqueue.variables.startNow ? 'generate' : 'enqueue') : null
                }
                errorMessage={enqueue.error?.message ?? null}
                // Starting a paused queue also resumes the jobs already waiting in it.
                resumedJobCount={
                    queueStatus.state === 'paused'
                        ? queueStatus.pendingCount
                        : queueStatus.state === 'pausing'
                          ? Math.max(0, queueStatus.pendingCount - 1)
                          : 0
                }
                onGenerate={() => enqueue.mutate({ position: 'front', startNow: true })}
                onEnqueue={() => enqueue.mutate({ position: 'back', startNow: false })}
            />
            <PlaygroundEditor
                settings={settings}
                onFieldChange={setField}
                onCharacterPromptsChange={setCharacterPrompts}
                onParameterChange={setParameter}
            />
        </div>
    )
}
