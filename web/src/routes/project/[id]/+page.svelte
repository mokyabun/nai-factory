<script lang="ts">
    import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query'
    import { api } from '$lib/api'
    import { qk } from '$lib/queries'
    import ParametersPanel from '$lib/components/app/project/parameters-panel.svelte'
    import CreateSceneDialog from '$lib/components/app/dialogs/create-scene-dialog.svelte'
    import { Button } from '$lib/components/ui/button'
    import SettingsIcon from '@lucide/svelte/icons/settings'
    import ListPlusIcon from '@lucide/svelte/icons/list-plus'
    import PlusIcon from '@lucide/svelte/icons/plus'
    import XIcon from '@lucide/svelte/icons/x'
    import { selectedProject } from '$lib/states/selected-project.svelte'
    import { DragDropProvider } from '@dnd-kit/svelte'
    import { move } from '@dnd-kit/helpers'
    import SortableSceneItem from '$lib/components/app/project/sortable-scene-item.svelte'

    type Scene = NonNullable<Awaited<ReturnType<typeof api.api.scenes.get>>['data']>[number]

    let { data } = $props()
    let projectId = $derived(data.projectId as number)

    const queryClient = useQueryClient()

    const projectQuery = createQuery(() => ({
        queryKey: qk.project(projectId),
        queryFn: async () => {
            const { data } = await api.api.projects({ projectId }).get()
            return data ?? null
        },
    }))

    const scenesQuery = createQuery(() => ({
        queryKey: qk.scenes(projectId),
        queryFn: async () => {
            const { data } = await api.api.scenes.get({ query: { projectId } })
            return data ?? []
        },
    }))

    const queueStatusQuery = createQuery(() => ({
        queryKey: qk.queueStatus(),
        queryFn: async () => {
            const { data } = await api.api.queue.status.get()
            return data ?? { running: false, processing: false, pendingCount: 0, estimatedSeconds: null, currentSceneId: null as number | null }
        },
        refetchInterval: 3000,
    }))

    const enqueueBulk = createMutation(() => ({
        mutationFn: (sceneIds: number[]) =>
            api.api.queue['enqueue-bulk'].post({ sceneIds }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            queryClient.invalidateQueries({ queryKey: qk.scenes(projectId) })
            selectedIds = new Set()
        },
    }))

    let parametersOpen = $state(false)
    let createSceneOpen = $state(false)
    let selectedIds = $state(new Set<number>())

    // Local scenes for drag-drop optimistic reordering
    let localScenes = $state<Scene[]>([])
    let isDragging = $state(false)

    $effect(() => {
        if (!isDragging) localScenes = [...(scenesQuery.data ?? [])]
        if (projectQuery.data) selectedProject.id = projectQuery.data.id
    })

    function toggleSelect(id: number) {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        selectedIds = next
    }

    function clearSelection() {
        selectedIds = new Set()
    }

    async function handleEnqueueAll() {
        await api.api.queue['enqueue-all'].post({ projectId })
        queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
        queryClient.invalidateQueries({ queryKey: qk.scenes(projectId) })
    }

    async function handleCreateScene(name: string) {
        await api.api.scenes.post({ projectId, name })
        queryClient.invalidateQueries({ queryKey: qk.scenes(projectId) })
    }

    function onDragStart() {
        isDragging = true
    }

    function onDragOver(event: any) {
        localScenes = move(localScenes, event)
    }

    async function onDragEnd(event: any) {
        isDragging = false
        if (event.canceled) return

        const sourceId = event.operation.source?.id as number
        const newIndex = localScenes.findIndex((s) => s.id === sourceId)
        const prevId = localScenes[newIndex - 1]?.id ?? null
        const nextId = localScenes[newIndex + 1]?.id ?? null

        await api.api.scenes({ id: sourceId }).order.patch({ prevId, nextId })
        queryClient.invalidateQueries({ queryKey: qk.scenes(projectId) })
    }

    let currentSceneId = $derived(queueStatusQuery.data?.currentSceneId ?? null)
    let selectionMode = $derived(selectedIds.size > 0)
</script>

{#if projectQuery.data}
    {@const project = projectQuery.data}
    <div class="flex h-full flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex shrink-0 items-center justify-between border-b px-4 py-2">
            <h1 class="text-sm font-semibold">{project.name}</h1>
            <div class="flex items-center gap-2">
                {#if selectionMode}
                    <!-- Bulk selection controls -->
                    <span class="text-xs text-muted-foreground">{selectedIds.size}개 선택됨</span>
                    <Button
                        size="sm"
                        class="h-7 gap-1.5 text-xs"
                        onclick={() => enqueueBulk.mutate([...selectedIds])}
                        disabled={enqueueBulk.isPending}
                    >
                        <ListPlusIcon class="h-3.5 w-3.5" />
                        선택 씬 큐 추가
                    </Button>
                    <Button variant="ghost" size="icon" class="h-7 w-7" onclick={clearSelection} title="선택 해제">
                        <XIcon class="h-3.5 w-3.5" />
                    </Button>
                {:else}
                    <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" onclick={handleEnqueueAll}>
                        <ListPlusIcon class="h-3.5 w-3.5" />
                        전체 큐 추가
                    </Button>
                    <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" onclick={() => (createSceneOpen = true)}>
                        <PlusIcon class="h-3.5 w-3.5" />
                        새 씬
                    </Button>
                    <Button variant="outline" size="icon" class="h-7 w-7" onclick={() => (parametersOpen = true)} title="생성 파라미터">
                        <SettingsIcon class="h-3.5 w-3.5" />
                    </Button>
                {/if}
            </div>
        </div>

        <!-- Scene card gallery -->
        <div class="flex-1 overflow-y-auto">
            {#if scenesQuery.isPending}
                <div class="flex h-full items-center justify-center text-sm text-muted-foreground">
                    불러오는 중...
                </div>
            {:else if localScenes.length === 0}
                <div class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                    <p class="text-sm">씬이 없습니다</p>
                    <Button variant="outline" size="sm" class="gap-1.5 text-xs" onclick={() => (createSceneOpen = true)}>
                        <PlusIcon class="h-3.5 w-3.5" />
                        첫 씬 만들기
                    </Button>
                </div>
            {:else}
                <DragDropProvider {onDragStart} {onDragOver} {onDragEnd}>
                    <div class="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {#each localScenes as scene, index (scene.id)}
                            <SortableSceneItem
                                {scene}
                                {index}
                                selected={selectedIds.has(scene.id)}
                                isProcessing={currentSceneId === scene.id}
                                ontoggleselect={toggleSelect}
                            />
                        {/each}
                    </div>
                </DragDropProvider>
            {/if}
        </div>
    </div>

    <ParametersPanel bind:open={parametersOpen} {project} />
    <CreateSceneDialog bind:open={createSceneOpen} oncreate={handleCreateScene} />
{:else if projectQuery.isError}
    <div class="flex h-full items-center justify-center text-muted-foreground">
        프로젝트를 불러올 수 없습니다
    </div>
{/if}
