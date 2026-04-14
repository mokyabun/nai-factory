<script lang="ts">
    import { api } from '$lib/api'
    import { onMount, untrack } from 'svelte'
    import VariationEditor from './variation-editor.svelte'
    import { Button } from '$lib/components/ui/button'
    import * as ScrollArea from '$lib/components/ui/scroll-area'
    import * as Dialog from '$lib/components/ui/dialog'
    import ConfirmDeleteDialog from '$lib/components/app/dialogs/confirm-delete-dialog.svelte'
    import PlusCircleIcon from '@lucide/svelte/icons/plus-circle'
    import Trash2Icon from '@lucide/svelte/icons/trash-2'
    import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw'
    import * as ContextMenu from '$lib/components/ui/context-menu'

    type Scene = NonNullable<Awaited<ReturnType<typeof api.api.scenes.get>>['data']>[number]
    type Image = NonNullable<Awaited<ReturnType<typeof api.api.images.get>>['data']>[number]
    type Variation = Record<string, string>

    let {
        scene,
        onupdate,
    }: {
        scene: Scene
        onupdate?: () => void
    } = $props()

    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

    let images = $state<Image[]>([])
    let loading = $state(true)
    let variations = $state<Variation[]>(untrack(() => [...(scene.variations ?? [])]))
    let sceneName = $state(untrack(() => scene.name))
    let saveTimeout: ReturnType<typeof setTimeout> | null = null
    let imageViewOpen = $state(false)
    let selectedImage = $state<Image | null>(null)
    let deleteImageOpen = $state(false)
    let imageToDelete = $state<Image | null>(null)

    async function loadImages() {
        loading = true
        const { data } = await api.api.images.get({ query: { sceneId: scene.id } })
        images = data ?? []
        loading = false
    }

    onMount(loadImages)

    // Sync variations when scene changes
    $effect(() => {
        variations = [...(scene.variations ?? [])]
        sceneName = scene.name
    })

    function scheduleVariationSave(v: Variation[]) {
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(async () => {
            await api.api.scenes({ id: scene.id }).patch({ variations: v })
        }, 800)
    }

    function handleVariationsChange(v: Variation[]) {
        variations = v
        scheduleVariationSave(v)
    }

    async function handleNameBlur() {
        if (sceneName.trim() && sceneName !== scene.name) {
            await api.api.scenes({ id: scene.id }).patch({ name: sceneName.trim() })
            onupdate?.()
        }
    }

    async function handleEnqueueScene() {
        await api.api.queue.enqueue.post({ sceneId: scene.id })
    }

    async function handleDeleteImage(img: Image) {
        await api.api.images({ id: img.id }).delete()
        images = images.filter((i) => i.id !== img.id)
    }

    function getImageUrl(path: string) {
        return `${BASE_URL}/${path}`
    }
</script>

<div class="flex h-full flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <input
            class="text-sm font-medium bg-transparent outline-none border-b border-transparent focus:border-border"
            bind:value={sceneName}
            onblur={handleNameBlur}
            onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLElement).blur() }}
        />
        <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" onclick={loadImages}>
                <RefreshCwIcon class="h-3.5 w-3.5" />
                새로고침
            </Button>
            <Button size="sm" class="h-7 gap-1.5 text-xs" onclick={handleEnqueueScene}>
                <PlusCircleIcon class="h-3.5 w-3.5" />
                큐에 추가
            </Button>
        </div>
    </div>

    <ScrollArea.Root class="flex-1">
        <div class="flex flex-col gap-6 p-4">
            <!-- Image gallery -->
            <section>
                <h3 class="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    이미지 ({images.length})
                </h3>
                {#if loading}
                    <div class="grid grid-cols-4 gap-2">
                        {#each { length: 4 } as _}
                            <div class="aspect-square animate-pulse rounded-md bg-muted"></div>
                        {/each}
                    </div>
                {:else if images.length === 0}
                    <div class="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
                        아직 생성된 이미지가 없습니다
                    </div>
                {:else}
                    <div class="grid grid-cols-4 gap-2">
                        {#each images as img (img.id)}
                            <ContextMenu.Root>
                                <ContextMenu.Trigger>
                                    <button
                                        class="aspect-square w-full overflow-hidden rounded-md border bg-muted"
                                        onclick={() => {
                                            selectedImage = img
                                            imageViewOpen = true
                                        }}
                                    >
                                        <img
                                            src={getImageUrl(img.thumbnailPath ?? img.filePath)}
                                            alt="generated"
                                            class="h-full w-full object-cover"
                                            loading="lazy"
                                        />
                                    </button>
                                </ContextMenu.Trigger>
                                <ContextMenu.Content>
                                    <ContextMenu.Item
                                        class="text-destructive"
                                        onclick={() => {
                                            imageToDelete = img
                                            deleteImageOpen = true
                                        }}
                                    >
                                        <Trash2Icon class="mr-2 h-4 w-4" />
                                        삭제
                                    </ContextMenu.Item>
                                </ContextMenu.Content>
                            </ContextMenu.Root>
                        {/each}
                    </div>
                {/if}
            </section>

            <!-- Variation editor -->
            <section>
                <h3 class="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    변수 세트 ({variations.length}개 → {variations.length}장 생성)
                </h3>
                <VariationEditor bind:variations onchange={handleVariationsChange} />
            </section>
        </div>
    </ScrollArea.Root>
</div>

<!-- Image view dialog -->
<Dialog.Root bind:open={imageViewOpen}>
    <Dialog.Content class="max-w-3xl">
        <Dialog.Header>
            <Dialog.Title>이미지</Dialog.Title>
        </Dialog.Header>
        {#if selectedImage}
            <img
                src={getImageUrl(selectedImage.filePath)}
                alt="generated full"
                class="max-h-[70vh] w-full rounded-md object-contain"
            />
        {/if}
    </Dialog.Content>
</Dialog.Root>

<!-- Delete image confirm -->
<ConfirmDeleteDialog
    bind:open={deleteImageOpen}
    title="이미지 삭제"
    description="이 이미지를 삭제합니다. 이 작업은 되돌릴 수 없습니다."
    onconfirm={() => imageToDelete && handleDeleteImage(imageToDelete)}
/>
