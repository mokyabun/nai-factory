<script lang="ts">
    import { page } from '$app/state'
    import { goto } from '$app/navigation'
    import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query'
    import { api } from '$lib/api'
    import { qk } from '$lib/queries'
    import { DragDropProvider } from '@dnd-kit/svelte'
    import { move } from '@dnd-kit/helpers'
    import SortableImageItem from '$lib/components/app/project/sortable-image-item.svelte'
    import ConfirmDeleteDialog from '$lib/components/app/dialogs/confirm-delete-dialog.svelte'
    import { Button } from '$lib/components/ui/button'
    import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'

    type Image = NonNullable<Awaited<ReturnType<typeof api.api.images.get>>['data']>[number]

    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

    const projectId = $derived(page.params.id)
    const sceneId = $derived(+(page.url.searchParams.get('scene') ?? '0'))

    const queryClient = useQueryClient()

    const scenesQuery = createQuery(() => ({
        queryKey: qk.scenes(+projectId),
        queryFn: async () => {
            const { data } = await api.api.scenes.get({ query: { projectId: +projectId } })
            return data ?? []
        },
        enabled: !!projectId,
    }))
    const scene = $derived(scenesQuery.data?.find((s) => s.id === sceneId) ?? null)

    const imagesQuery = createQuery(() => ({
        queryKey: qk.images(sceneId),
        queryFn: async () => {
            const { data } = await api.api.images.get({ query: { sceneId } })
            return data ?? []
        },
        enabled: sceneId > 0,
    }))

    const deleteImage = createMutation(() => ({
        mutationFn: (id: number) => api.api.images({ id }).delete(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.images(sceneId) }),
    }))

    let deleteOpen = $state(false)
    let imageToDelete = $state<Image | null>(null)

    let localImages = $state<Image[]>([])
    let isDragging = $state(false)

    $effect(() => {
        if (!isDragging) localImages = [...(imagesQuery.data ?? [])]
    })

    function getImageUrl(path: string) {
        return `${BASE_URL}/${path}`
    }

    function openViewer(img: Image) {
        goto(`/project/${projectId}/images/${img.id}?scene=${sceneId}`)
    }

    function onDragStart() { isDragging = true }
    function onDragOver(event: any) { localImages = move(localImages, event) }

    async function onDragEnd(event: any) {
        isDragging = false
        if (event.canceled) return

        const sourceId = event.operation.source?.id as number
        const newIndex = localImages.findIndex((i) => i.id === sourceId)
        const prevId = localImages[newIndex - 1]?.id ?? null
        const nextId = localImages[newIndex + 1]?.id ?? null

        await api.api.images({ id: sourceId }).order.patch({ prevId, nextId })
        queryClient.invalidateQueries({ queryKey: qk.images(sceneId) })
    }
</script>

<div class="flex h-dvh flex-col">
    <!-- Header -->
    <div class="flex shrink-0 items-center gap-3 border-b px-6 py-4">
        <Button variant="ghost" size="icon-sm" onclick={() => history.back()}>
            <ArrowLeftIcon class="h-4 w-4" />
        </Button>
        <div>
            <h1 class="text-base font-semibold">{scene?.name ?? '로딩 중...'}</h1>
            <p class="text-xs text-muted-foreground">
                이미지 {localImages.length}장 · 드래그로 순서 변경 · 클릭하면 전체 화면으로 보기
            </p>
        </div>
    </div>

    <!-- Grid -->
    <div class="flex-1 overflow-auto p-6">
        {#if imagesQuery.isPending}
            <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {#each Array.from({ length: 6 }) as _}
                    <div class="aspect-[3/4] animate-pulse rounded-lg bg-muted"></div>
                {/each}
            </div>
        {:else if localImages.length === 0}
            <div class="flex h-full items-center justify-center text-muted-foreground">
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
</div>

<ConfirmDeleteDialog
    bind:open={deleteOpen}
    title="이미지 삭제"
    description="이 이미지를 삭제합니다. 이 작업은 되돌릴 수 없습니다."
    onconfirm={() => imageToDelete && deleteImage.mutate(imageToDelete.id)}
/>
