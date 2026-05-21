<script lang="ts">
import { DragDropProvider } from '@dnd-kit/svelte'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { ListPlus, Plus, SlidersHorizontal } from 'phosphor-svelte'
import { page } from '$app/state'
import { api } from '$lib/api'
import CreateNameDialog from '$lib/components/app/dialogs/create-name-dialog.svelte'
import ParametersPanel from '$lib/components/app/project/parameters-panel.svelte'
import SortableSceneItem from '$lib/components/app/project/sortable-scene-item.svelte'
import { Button } from '$lib/components/ui/button'
import { qk } from '$lib/query-keys'
import { movedIds } from '$lib/sortable'
import type { ProjectData, QueueStatus, Scene } from '$lib/types'

const queryClient = useQueryClient()
const projectId = $derived(Number(page.params.projectId))

const projectQuery = createQuery(() => ({
    queryKey: qk.project(projectId),
    queryFn: async () => {
        const { data } = await api.projects({ projectId }).get()
        return (data ?? null) as ProjectData | null
    },
}))

const scenesQuery = createQuery(() => ({
    queryKey: qk.scenes(projectId),
    queryFn: async () => {
        const { data } = await api.scenes.get({ query: { projectId } })
        return (data ?? []) as Scene[]
    },
}))

const queueStatusQuery = createQuery(() => ({
    queryKey: qk.queueStatus(),
    queryFn: async () => {
        const { data } = await api.queue.status.get()
        return data as QueueStatus | null
    },
}))

let items = $state<Scene[]>([])
$effect(() => {
    if (scenesQuery.data) items = scenesQuery.data
})

let selectedIds = $state<Set<number>>(new Set())
let paramsOpen = $state(false)
let createSceneOpen = $state(false)

const createScene = createMutation(() => ({
    mutationFn: (name: string) => api.scenes.post({ projectId, name }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.scenes(projectId) })
        createSceneOpen = false
    },
}))

const reorderScene = createMutation(() => ({
    mutationFn: ({
        id,
        prevId,
        nextId,
    }: {
        id: number
        prevId: number | null
        nextId: number | null
        snapshot: Scene[]
    }) => api.scenes({ id }).order.patch({ prevId, nextId }),
    onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: qk.scenes(projectId) })
    },
    onError: (_err, vars) => {
        items = vars.snapshot // 실패 시 롤백
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.scenes(projectId) }),
}))

const bulkEnqueue = createMutation(() => ({
    mutationFn: () => api.queue['enqueue-bulk'].post({ sceneIds: [...selectedIds] }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
        queryClient.invalidateQueries({ queryKey: qk.scenes(projectId) })
        selectedIds = new Set()
    },
}))

function handleDragEnd(event: {
    canceled: boolean
    operation: { source?: { id: unknown } | null; target?: { id: unknown } | null }
}) {
    if (event.canceled) return
    const sourceId = Number(event.operation.source?.id)
    const targetId = Number(event.operation.target?.id)
    const moved = movedIds(items, sourceId, targetId)
    if (!moved) return
    const snapshot = [...items]
    items = moved.items
    reorderScene.mutate({ id: sourceId, prevId: moved.prevId, nextId: moved.nextId, snapshot })
}

function handleDragOver(event: {
    operation: { source?: { id: unknown } | null; target?: { id: unknown } | null }
}) {
    const sourceId = Number(event.operation.source?.id)
    const targetId = Number(event.operation.target?.id)
    items = movedIds(items, sourceId, targetId)?.items ?? items
}

function toggleSelect(id: number) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds = next
}

const selectMode = $derived(selectedIds.size > 0)
const currentSceneId = $derived(queueStatusQuery.data?.currentSceneId ?? null)
</script>

<div class="flex h-full flex-col gap-4">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			{#if selectMode}
				<Button
					size="sm"
					class="gap-1.5"
					onclick={() => bulkEnqueue.mutate()}
					disabled={bulkEnqueue.isPending}
				>
					<ListPlus class="h-4 w-4" />
					선택 씬 큐 추가 ({selectedIds.size})
				</Button>
				<Button variant="ghost" size="sm" onclick={() => (selectedIds = new Set())}>
					선택 해제
				</Button>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if projectQuery.data}
				<Button variant="outline" size="sm" class="gap-1.5" onclick={() => (paramsOpen = true)}>
					<SlidersHorizontal class="h-4 w-4" />
					파라미터
				</Button>
			{/if}
			<Button size="sm" class="gap-1.5" onclick={() => (createSceneOpen = true)}>
				<Plus class="h-4 w-4" />새 씬
			</Button>
		</div>
	</div>

	{#if scenesQuery.isPending}
		<div class="flex flex-1 items-center justify-center text-sm text-muted-foreground">불러오는 중...</div>
	{:else if items.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
			<p class="text-sm">씬이 없습니다. 새 씬을 추가하세요.</p>
		</div>
	{:else}
		<DragDropProvider onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
			<div class="flex flex-wrap gap-4 pb-4">
				{#each items as scene, index (scene.id)}
					<SortableSceneItem
						{scene}
						{index}
						selected={selectedIds.has(scene.id)}
						{selectMode}
						isProcessing={scene.id === currentSceneId}
						slideshowCount={4}
						onToggleSelect={toggleSelect}
					/>
				{/each}
			</div>
		</DragDropProvider>
	{/if}
</div>

<CreateNameDialog
	bind:open={createSceneOpen}
	title="새 씬"
	placeholder="씬 이름..."
	onCreate={(name) => createScene.mutate(name)}
/>

{#if projectQuery.data}
	<ParametersPanel bind:open={paramsOpen} project={projectQuery.data} />
{/if}
