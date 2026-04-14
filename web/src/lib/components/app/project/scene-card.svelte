<script lang="ts">
    import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query'
    import { goto } from '$app/navigation'
    import { api } from '$lib/api'
    import { qk } from '$lib/queries'
    import { Button } from '$lib/components/ui/button'
    import ConfirmDeleteDialog from '$lib/components/app/dialogs/confirm-delete-dialog.svelte'
    import ImageIcon from '@lucide/svelte/icons/image'
    import ListPlusIcon from '@lucide/svelte/icons/list-plus'
    import Trash2Icon from '@lucide/svelte/icons/trash-2'
    import PencilIcon from '@lucide/svelte/icons/pencil'
    import CopyIcon from '@lucide/svelte/icons/copy'
    import LoaderIcon from '@lucide/svelte/icons/loader'
    import CheckIcon from '@lucide/svelte/icons/check'

    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

    type Scene = NonNullable<Awaited<ReturnType<typeof api.api.scenes.get>>['data']>[number]

    let {
        scene,
        selected = false,
        isProcessing = false,
        ontoggleselect,
    }: {
        scene: Scene
        selected?: boolean
        isProcessing?: boolean
        ontoggleselect?: (id: number) => void
    } = $props()

    const queryClient = useQueryClient()

    const imagesQuery = createQuery(() => ({
        queryKey: qk.images(scene.id),
        queryFn: async () => {
            const { data } = await api.api.images.get({ query: { sceneId: scene.id } })
            return data ?? []
        },
    }))

    const deleteScene = createMutation(() => ({
        mutationFn: (id: number) => api.api.scenes({ id }).delete(),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: qk.scenes(scene.projectId) }),
    }))

    const duplicateScene = createMutation(() => ({
        mutationFn: (id: number) => api.api.scenes({ id }).duplicate.post(),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: qk.scenes(scene.projectId) }),
    }))

    const enqueue = createMutation(() => ({
        mutationFn: (sceneId: number) => api.api.queue.enqueue.post({ sceneId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            queryClient.invalidateQueries({ queryKey: qk.scenes(scene.projectId) })
        },
    }))

    const clearQueue = createMutation(() => ({
        mutationFn: (sceneId: number) => api.api.queue.delete({ query: { sceneId } }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            queryClient.invalidateQueries({ queryKey: qk.scenes(scene.projectId) })
        },
    }))

    let deleteOpen = $state(false)

    function getImageUrl(path: string) {
        return `${BASE_URL}/${path}`
    }

    let images = $derived(imagesQuery.data ?? [])
    let thumbnails = $derived(images.slice(0, 4))
    let variationCount = $derived((scene.variations ?? []).length)
    let queueCount = $derived(scene.queueCount ?? 0)
    let inQueue = $derived(queueCount > 0)
</script>

<div
    class="relative flex flex-col overflow-hidden rounded-lg border bg-card transition-all hover:shadow-md
        {inQueue ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]' : ''}
        {selected ? 'ring-2 ring-primary ring-offset-2' : ''}"
>
    <!-- Queue count badge -->
    {#if inQueue}
        <div class="absolute right-1.5 top-1.5 z-20 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground shadow">
            큐 {queueCount}
        </div>
    {/if}

    <!-- Selection checkbox -->
    {#if ontoggleselect}
        <button
            class="absolute left-1.5 top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors
                {selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-white/70 bg-black/30 text-transparent hover:border-primary'}"
            onclick={(e) => { e.stopPropagation(); ontoggleselect?.(scene.id) }}
            title={selected ? '선택 해제' : '선택'}
        >
            <CheckIcon class="h-3 w-3" />
        </button>
    {/if}

    <!-- Image gallery area -->
    <button
        class="group relative aspect-video w-full overflow-hidden bg-muted text-left"
        onclick={() => goto(`/project/${scene.projectId}/images?scene=${scene.id}`)}
        title="이미지 보기"
    >
        {#if thumbnails.length === 0}
            <div class="flex h-full items-center justify-center">
                <ImageIcon class="h-10 w-10 text-muted-foreground/20" />
            </div>
        {:else if thumbnails.length === 1}
            <img
                src={getImageUrl(thumbnails[0].thumbnailPath ?? thumbnails[0].filePath)}
                alt={scene.name}
                class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                loading="lazy"
            />
        {:else}
            <div class="grid h-full w-full grid-cols-2 gap-px bg-border">
                {#each thumbnails as img (img.id)}
                    <img
                        src={getImageUrl(img.thumbnailPath ?? img.filePath)}
                        alt={scene.name}
                        class="h-full w-full object-cover"
                        loading="lazy"
                    />
                {/each}
            </div>
        {/if}

        <!-- Image count badge -->
        {#if images.length > 0}
            <div class="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {images.length}장
            </div>
        {/if}

        <!-- Processing overlay -->
        {#if isProcessing}
            <div class="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
                <div class="flex flex-col items-center gap-1.5">
                    <LoaderIcon class="h-7 w-7 animate-spin text-white drop-shadow" />
                    <span class="text-[10px] font-semibold text-white drop-shadow">생성 중</span>
                </div>
            </div>
        {/if}
    </button>

    <!-- Info -->
    <div class="flex items-start justify-between px-3 py-2.5">
        <div class="min-w-0">
            <div class="truncate text-sm font-medium">{scene.name}</div>
            <div class="mt-0.5 text-xs text-muted-foreground">
                변수 세트 {variationCount}개
            </div>
        </div>
        <div class="ml-1 flex shrink-0 gap-0.5">
            <button
                class="rounded p-1 text-muted-foreground/40 hover:bg-accent hover:text-foreground disabled:opacity-30"
                onclick={() => duplicateScene.mutate(scene.id)}
                disabled={duplicateScene.isPending}
                title="씬 복제"
            >
                <CopyIcon class="h-3.5 w-3.5" />
            </button>
            <button
                class="rounded p-1 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
                onclick={() => (deleteOpen = true)}
                title="씬 삭제"
            >
                <Trash2Icon class="h-3.5 w-3.5" />
            </button>
        </div>
    </div>

    <!-- Actions -->
    <div class="mt-auto flex border-t">
        <Button
            variant="ghost"
            size="sm"
            class="h-8 flex-1 gap-1 rounded-none text-xs"
            onclick={() => enqueue.mutate(scene.id)}
            disabled={enqueue.isPending}
            title="이 씬을 큐에 추가"
        >
            <ListPlusIcon class="h-3.5 w-3.5" />
            큐 추가
        </Button>
        <div class="w-px bg-border"></div>
        <Button
            variant="ghost"
            size="sm"
            class="h-8 flex-1 gap-1 rounded-none text-xs text-muted-foreground hover:text-destructive"
            onclick={() => clearQueue.mutate(scene.id)}
            disabled={clearQueue.isPending || !inQueue}
            title="이 씬의 대기 중인 큐 항목 삭제"
        >
            <Trash2Icon class="h-3.5 w-3.5" />
            큐 삭제
        </Button>
        <div class="w-px bg-border"></div>
        <Button
            variant="ghost"
            size="sm"
            class="h-8 flex-1 gap-1 rounded-none text-xs"
            onclick={() => goto(`/project/${scene.projectId}/scenes/${scene.id}/edit`)}
            title="씬 수정"
        >
            <PencilIcon class="h-3.5 w-3.5" />
            수정
        </Button>
    </div>
</div>

<ConfirmDeleteDialog
    bind:open={deleteOpen}
    title="씬 삭제"
    description={`"${scene.name}" 씬과 모든 생성된 이미지를 삭제합니다. 되돌릴 수 없습니다.`}
    onconfirm={() => deleteScene.mutate(scene.id)}
/>
