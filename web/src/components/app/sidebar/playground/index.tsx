import type { EnqueuePosition, Parameters, PlaygroundState, QueueStatus } from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAtom } from 'jotai'
import { useEffect, useRef } from 'react'

import { useQueueStatus } from '@/hooks/use-queue'
import { call, contract } from '@/lib/api'
import { restoreSnapshot, restoreSnapshots, snapshotQueries, snapshotQuery } from '@/lib/optimistic'
import { qk } from '@/lib/queries'
import { debounce } from '@/lib/utils'

import { DEFAULT_PLAYGROUND_STATE, playgroundSettingsAtom } from './atom'
import { PlaygroundEditor } from './playground-editor'
import { PlaygroundHeader } from './playground-header'

type EnqueueRequest = {
    position: EnqueuePosition
    startNow: boolean
}

export function SidebarPlayground() {
    const queryClient = useQueryClient()
    const [settings, setSettings] = useAtom(playgroundSettingsAtom)
    const latestSettingsRef = useRef<PlaygroundState>(DEFAULT_PLAYGROUND_STATE)
    const dirtyRef = useRef(false)

    const settingsQuery = useQuery({
        queryKey: qk.playground.state(),
        queryFn: () => call(contract.playground.state),
    })

    const saveSettingsRef = useRef(
        // eslint-disable-next-line react/refs -- The ref is used by event handlers and debounced callbacks, not to render UI.
        debounce(async (nextSettings: PlaygroundState) => {
            const previousSettings = await snapshotQuery<PlaygroundState>(
                queryClient,
                qk.playground.state(),
            )
            queryClient.setQueryData(qk.playground.state(), nextSettings)
            const data = await call(contract.playground.updateState, {
                body: {
                    prompt: nextSettings.prompt,
                    negativePrompt: nextSettings.negativePrompt,
                    parameters: nextSettings.parameters,
                },
            }).catch(() => null)

            if (JSON.stringify(latestSettingsRef.current) !== JSON.stringify(nextSettings)) return
            if (!data) {
                restoreSnapshot(queryClient, previousSettings)
                return
            }

            dirtyRef.current = false
            queryClient.setQueryData(qk.playground.state(), data)
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
                // The current editor values go along, so unsaved edits are part of the snapshot.
                await call(contract.jobs.enqueuePlayground, {
                    body: {
                        prompt: settings.prompt,
                        negativePrompt: settings.negativePrompt,
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
                predicate: (query) => query.queryKey[0] === 'jobs',
            })
            queryClient.setQueryData<QueueStatus>(qk.jobs.status(), (status) =>
                status
                    ? {
                          ...status,
                          pendingCount: status.pendingCount + 1,
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

    function updateSettings(updater: (prev: PlaygroundState) => PlaygroundState) {
        setSettings((prev) => {
            const nextSettings = updater(prev)
            latestSettingsRef.current = nextSettings
            dirtyRef.current = true
            saveSettingsRef.current(nextSettings)
            return nextSettings
        })
    }

    function setField<K extends keyof PlaygroundState>(key: K, value: PlaygroundState[K]) {
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
