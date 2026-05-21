<script lang="ts">
import { DragDropProvider } from '@dnd-kit/svelte'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { Upload } from 'phosphor-svelte'
import { api } from '$lib/api'
import { Button } from '$lib/components/ui/button'
import { Input } from '$lib/components/ui/input'
import { qk } from '$lib/query-keys'
import { movedIds } from '$lib/sortable'
import type { VibeTransfer } from '$lib/types'
import SortableVibeItem from './sortable-vibe-item.svelte'

let { projectId }: { projectId: number } = $props()
const queryClient = useQueryClient()
let fileInput = $state<HTMLInputElement | null>(null)
let items = $state<VibeTransfer[]>([])
let loadedSignature = $state('')

const query = createQuery(() => ({
    queryKey: qk.vibeTransfers(projectId),
    queryFn: async () => {
        const { data } = await api.projects({ projectId })['vibe-transfers'].get()
        return (data ?? []) as VibeTransfer[]
    },
}))

$effect(() => {
    const data = query.data
    if (!data) return
    const signature = data.map((item) => `${item.id}:${item.displayOrder}`).join('|')
    if (signature === loadedSignature) return
    loadedSignature = signature
    items = data
})

const uploadMutation = createMutation(() => ({
    mutationFn: (file: File) =>
        api.projects({ projectId })['vibe-transfers'].upload.post({ image: file }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.vibeTransfers(projectId) }),
}))
const updateMutation = createMutation(() => ({
    mutationFn: ({
        id,
        patch,
    }: {
        id: number
        patch: { referenceStrength?: number; informationExtracted?: number }
    }) => api.projects({ projectId })['vibe-transfers']({ id }).patch(patch),
}))
const deleteMutation = createMutation(() => ({
    mutationFn: (id: number) => api.projects({ projectId })['vibe-transfers']({ id }).delete(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.vibeTransfers(projectId) }),
}))
const reorderMutation = createMutation(() => ({
    mutationFn: ({
        id,
        prevId,
        nextId,
    }: {
        id: number
        prevId: number | null
        nextId: number | null
    }) => api.projects({ projectId })['vibe-transfers'].reorder.patch({ id, prevId, nextId }),
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
    items = moved.items
    reorderMutation.mutate({ id: sourceId, prevId: moved.prevId, nextId: moved.nextId })
}

function handleFileChange(files: FileList | undefined) {
    const file = files?.[0]
    if (!file) return
    uploadMutation.mutate(file)
    if (fileInput) fileInput.value = ''
}
</script>

<div class="flex flex-col gap-3">
	<Input
		bind:ref={fileInput}
		type="file"
		accept="image/*"
		class="hidden"
		onchange={(event) => handleFileChange(event.currentTarget.files ?? undefined)}
	/>

	{#if query.isPending}
		<div class="py-4 text-center text-xs text-muted-foreground">불러오는 중...</div>
	{:else if items.length === 0}
		<div class="py-4 text-center text-xs text-muted-foreground">바이브 이미지 없음</div>
	{:else}
		<DragDropProvider onDragEnd={handleDragEnd}>
			<div class="flex flex-col gap-2">
				{#each items as vibe, index (vibe.id)}
					<SortableVibeItem
						{vibe}
						{index}
						onUpdate={(id, patch) => updateMutation.mutate({ id, patch })}
						onDelete={(id) => deleteMutation.mutate(id)}
					/>
				{/each}
			</div>
		</DragDropProvider>
	{/if}

	<Button
		variant="outline"
		size="sm"
		class="gap-1.5"
		onclick={() => fileInput?.click()}
		disabled={uploadMutation.isPending}
	>
		<Upload class="h-3.5 w-3.5" />
		{uploadMutation.isPending ? '업로드 중...' : '이미지 업로드'}
	</Button>
</div>
