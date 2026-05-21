<script lang="ts">
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { DragDropProvider } from '@dnd-kit/svelte'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { ArrowLeft } from 'phosphor-svelte'
import ConfirmDeleteDialog from '$lib/components/app/dialogs/confirm-delete-dialog.svelte'
import SortableImageItem from '$lib/components/app/project/sortable-image-item.svelte'
import { Button } from '$lib/components/ui/button'
import { api, imageUrl } from '$lib/api'
import { qk } from '$lib/query-keys'
import { movedIds } from '$lib/sortable'
import type { ImageItem } from '$lib/types'

let { children } = $props()

const queryClient = useQueryClient()
const sceneId = $derived(Number(page.params.sceneId))

const imagesQuery = createQuery(() => ({
    queryKey: qk.images(sceneId),
    queryFn: async () => {
        const { data } = await api.images.get({ query: { sceneId } })
        return (data ?? []) as ImageItem[]
    },
}))

let items = $state<ImageItem[]>([])
let loadedSignature = $state('')
let deleteTarget = $state<ImageItem | null>(null)

$effect(() => {
    const data = imagesQuery.data
    if (!data) return
    const signature = data.map((item) => item.id).join('|')
    if (signature === loadedSignature) return
    loadedSignature = signature
    items = data
})

const deleteImage = createMutation(() => ({
    mutationFn: (img: ImageItem) => api.images({ id: img.id }).delete(),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.images(sceneId) })
        deleteTarget = null
    },
}))

const reorderImages = createMutation(() => ({
    mutationFn: ({
        id,
        prevId,
        nextId,
    }: {
        id: number
        prevId: number | null
        nextId: number | null
    }) => api.images({ id }).order.patch({ prevId, nextId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.images(sceneId) }),
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
    reorderImages.mutate({ id: sourceId, prevId: moved.prevId, nextId: moved.nextId })
}
</script>

<div class="flex h-full flex-col gap-4">
	<div class="flex items-center gap-2">
		<Button
			variant="ghost"
			size="icon-sm"
			class="h-8 w-8 shrink-0"
			onclick={() => goto(`/scene/${sceneId}`)}
		>
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<span class="text-sm font-medium">이미지 ({imagesQuery.data?.length ?? 0}장)</span>
	</div>

	{#if imagesQuery.isPending}
		<div class="flex flex-1 items-center justify-center text-sm text-muted-foreground">불러오는 중...</div>
	{:else if items.length === 0}
		<div class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
			생성된 이미지가 없습니다.
		</div>
	{:else}
		<DragDropProvider onDragEnd={handleDragEnd}>
			<div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 pb-4">
				{#each items as img, index (img.id)}
					<SortableImageItem
						{img}
						{index}
						src={imageUrl(img.thumbnailPath ?? img.filePath)}
						onView={(target) => goto(`/scene/${sceneId}/images/${target.id}`)}
						onDelete={(target) => (deleteTarget = target)}
					/>
				{/each}
			</div>
		</DragDropProvider>
	{/if}
</div>

{@render children()}

<ConfirmDeleteDialog
	open={deleteTarget !== null}
	title="이미지 삭제"
	description="이 이미지를 삭제합니다. 되돌릴 수 없습니다."
	onConfirm={() => deleteTarget && deleteImage.mutate(deleteTarget)}
/>
