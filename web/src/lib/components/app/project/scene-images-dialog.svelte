<script lang="ts">
    import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query'
    import { goto } from '$app/navigation'
    import { api } from '$lib/api'
    import { qk } from '$lib/queries'
    import * as Dialog from '$lib/components/ui/dialog'
    import * as ScrollArea from '$lib/components/ui/scroll-area'
    import ConfirmDeleteDialog from '$lib/components/app/dialogs/confirm-delete-dialog.svelte'
    import { DragDropProvider } from '@dnd-kit/svelte'
    import { move } from '@dnd-kit/helpers'
    import SortableImageItem from './sortable-image-item.svelte'

    type Scene = NonNullable<Awaited<ReturnType<typeof api.api.scenes.get>>['data']>[number]
    type Image = NonNullable<Awaited<ReturnType<typeof api.api.images.get>>['data']>[number]

    let {
        scene,
        open = $bindable(false),
    }: {
        scene: Scene
        open?: boolean
    } = $props()

    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

    const queryClient = useQueryClient()

    const imagesQuery = createQuery(() => ({
        queryKey: qk.images(scene.id),
        queryFn: async () => {
            const { data } = await api.api.images.get({ query: { sceneId: scene.id } })
            return data ?? []
        },
        enabled: open,
    }))

    const deleteImage = createMutation(() => ({
        mutationFn: (id: number) => api.api.images({ id }).delete(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.images(scene.id) }),
    }))

    let deleteOpen = $state(false)
    let imageToDelete = $state<Image | null>(null)

    // Local images for drag-drop
    let localImages = $state<Image[]>([])
    let isDragging = $state(false)

    $effect(() => {
        if (!isDragging) localImages = [...(imagesQuery.data ?? [])]
    })

    function getImageUrl(path: string) {
        return `${BASE_URL}/${path}`
    }

    function openViewer(img: Image) {
        goto(`/project/${scene.projectId}/images/${img.id}?scene=${scene.id}`)
    }

    function onDragStart() {
        isDragging = true
    }

    function onDragOver(event: any) {
        localImages = move(localImages, event)
    }

    async function onDragEnd(event: any) {
        isDragging = false
        if (event.canceled) return

        const sourceId = event.operation.source?.id as number
        const newIndex = localImages.findIndex((i) => i.id === sourceId)
        const prevId = localImages[newIndex - 1]?.id ?? null
        const nextId = localImages[newIndex + 1]?.id ?? null

        await api.api.images({ id: sourceId }).order.patch({ prevId, nextId })
        queryClient.invalidateQueries({ queryKey: qk.images(scene.id) })
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="flex h-[95dvh] flex-col gap-0 p-0" style="width: 95vw; max-width: none;">
        <Dialog.Header class="shrink-0 border-b px-6 py-4">
            <Dialog.Title class="text-base">{scene.name}</Dialog.Title>
            <Dialog.Description class="text-xs">
                이미지 {localImages.length}장 · 드래그로 순서 변경 · 클릭하면 전체 화면으로 보기
            </Dialog.Description>
        </Dialog.Header>

        <ScrollArea.Root class="flex-1 overflow-hidden">
            <div class="p-6">
                {#if imagesQuery.isPending}
                    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {#each Array.from({ length: 6 }) as _}
                            <div class="aspect-[3/4] animate-pulse rounded-lg bg-muted"></div>
                        {/each}
                    </div>
                {:else if localImages.length === 0}
                    <div class="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                        <p class="text-sm">아직 생성된 이미지가 없습니다</p>
                    </div>
                {:else}
                    <DragDropProvider {onDragStart} {onDragOver} {onDragEnd}>
                        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {#each localImages as img, index (img.id)}
                                <SortableImageItem
                                    {img}
                                    {index}
                                    imageUrl={getImageUrl(img.thumbnailPath ?? img.filePath)}
                                    onview={openViewer}
                                    ondelete={(i) => { imageToDelete = i; deleteOpen = true }}
                                />
                            {/each}
                        </div>
                    </DragDropProvider>
                {/if}
            </div>
        </ScrollArea.Root>
    </Dialog.Content>
</Dialog.Root>

<ConfirmDeleteDialog
    bind:open={deleteOpen}
    title="이미지 삭제"
    description="이 이미지를 삭제합니다. 이 작업은 되돌릴 수 없습니다."
    onconfirm={() => imageToDelete && deleteImage.mutate(imageToDelete.id)}
/>
