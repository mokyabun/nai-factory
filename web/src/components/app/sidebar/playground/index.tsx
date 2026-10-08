import {
    DEFAULT_PLAYGROUND_SETTINGS,
    type EnqueuePosition,
    type Parameters,
    type PlaygroundSettings,
} from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAtom } from 'jotai'
import { useEffect, useRef } from 'react'

import { useQueueStatus } from '@/hooks/use-queue'
import { api, type QueueStatus } from '@/lib/api'
import {
    requireApiResult,
    restoreSnapshot,
    restoreSnapshots,
    snapshotQueries,
    snapshotQuery,
} from '@/lib/optimistic'
import { qk } from '@/lib/queries'
import { debounce } from '@/lib/utils'

import { playgroundSettingsAtom } from './atom'
import { PlaygroundEditor } from './playground-editor'
import { PlaygroundHeader } from './playground-header'

type EnqueueRequest = {
    position: EnqueuePosition
    startNow: boolean
}

export function SidebarPlayground() {
    const queryClient = useQueryClient()
    const [settings, setSettings] = useAtom(playgroundSettingsAtom)
    const latestSettingsRef = useRef<PlaygroundSettings>(DEFAULT_PLAYGROUND_SETTINGS)
    const dirtyRef = useRef(false)

    const settingsQuery = useQuery({
        queryKey: qk.playgroundSettings(),
        queryFn: async () => {
            const { data } = await api.playground.settings.get()
            return data ?? DEFAULT_PLAYGROUND_SETTINGS
        },
    })

    const saveSettingsRef = useRef(
        // eslint-disable-next-line react/refs -- The ref is used by event handlers and debounced callbacks, not to render UI.
        debounce(async (nextSettings: PlaygroundSettings) => {
            const previousSettings = await snapshotQuery<PlaygroundSettings>(
                queryClient,
                qk.playgroundSettings(),
            )
            queryClient.setQueryData(qk.playgroundSettings(), nextSettings)
            const { data } = await api.playground.settings.patch({
                prompt: nextSettings.prompt,
                negativePrompt: nextSettings.negativePrompt,
                parameters: nextSettings.parameters,
            })

            if (JSON.stringify(latestSettingsRef.current) !== JSON.stringify(nextSettings)) return
            if (!data) {
                restoreSnapshot(queryClient, previousSettings)
                return
            }

            dirtyRef.current = false
            queryClient.setQueryData(qk.playgroundSettings(), data)
        }, 600),
    )

    useEffect(() => {
        if (!dirtyRef.current && settingsQuery.data) {
            latestSettingsRef.current = settingsQuery.data
            setSettings(settingsQuery.data)
        }
    }, [settingsQuery.data, setSettings])

    useEffect(() => {
        const cleanupSaveSettings = saveSettingsRef.current
        return () => cleanupSaveSettings.flush()
    }, [])

    const { status: queueStatus } = useQueueStatus()

    const enqueue = useMutation({
        mutationFn: async ({ position, startNow }: EnqueueRequest) => {
            try {
                await requireApiResult(
                    api.playground.enqueue.post({
                        prompt: settings.prompt,
                        negativePrompt: settings.negativePrompt,
                        parameters: settings.parameters,
                        position,
                    }),
                )
            } catch (error) {
                throw new Error('대기열에 추가하지 못했습니다', { cause: error })
            }
            if (!startNow) return

            try {
                await requireApiResult(api.queue.start.post())
            } catch (error) {
                throw new Error('대기열에는 추가했지만 생성을 시작하지 못했습니다', {
                    cause: error,
                })
            }
        },
        onMutate: async ({ startNow }) => {
            const snapshots = await snapshotQueries(queryClient, {
                predicate: (query) => query.queryKey[0] === 'queue',
            })
            queryClient.setQueryData<QueueStatus>(qk.queueStatus(), (status) =>
                status
                    ? {
                          ...status,
                          pendingCount: status.pendingCount + 1,
                          ...(startNow && {
                              running: true,
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
            void queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            void queryClient.invalidateQueries({ queryKey: qk.queue(null) })
        },
    })

    function updateSettings(updater: (prev: PlaygroundSettings) => PlaygroundSettings) {
        setSettings((prev) => {
            const nextSettings = updater(prev)
            latestSettingsRef.current = nextSettings
            dirtyRef.current = true
            saveSettingsRef.current(nextSettings)
            return nextSettings
        })
    }

    function setField<K extends keyof PlaygroundSettings>(key: K, value: PlaygroundSettings[K]) {
        updateSettings((prev) => ({ ...prev, [key]: value }))
    }

    function setParameter<K extends keyof Parameters>(key: K, value: Parameters[K]) {
        updateSettings((prev) => ({
            ...prev,
            parameters: { ...prev.parameters, [key]: value },
        }))
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
                onParameterChange={setParameter}
            />
        </div>
    )
}
