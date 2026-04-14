<script lang="ts">
    import { api } from '$lib/api'
    import { Button } from '$lib/components/ui/button'
    import * as ScrollArea from '$lib/components/ui/scroll-area'
    import CreateSceneDialog from '$lib/components/app/dialogs/create-scene-dialog.svelte'
    import ConfirmDeleteDialog from '$lib/components/app/dialogs/confirm-delete-dialog.svelte'
    import SceneEditDialog from './scene-edit-dialog.svelte'
    import SceneImagesDialog from './scene-images-dialog.svelte'
    import PlusIcon from '@lucide/svelte/icons/plus'
    import ImageIcon from '@lucide/svelte/icons/image'
    import PlusCircleIcon from '@lucide/svelte/icons/plus-circle'
    import Trash2Icon from '@lucide/svelte/icons/trash-2'
    import SettingsIcon from '@lucide/svelte/icons/settings'

    type Scene = NonNullable<Awaited<ReturnType<typeof api.api.scenes.get>>['data']>[number]

    let {
        projectId,
        scenes = $bindable([]),
        onupdate,
    }: {
        projectId: number
        scenes?: Scene[]
        onupdate?: () => void
    } = $props()

    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

    let createSceneOpen = $state(false)
    let deleteOpen = $state(false)
    let sceneToDelete = $state<Scene | null>(null)
    let editScene = $state<Scene | null>(null)
    let editOpen = $state(false)
    let imagesScene = $state<Scene | null>(null)
    let imagesOpen = $state(false)

    // thumbnail cache: sceneId -> url
    let thumbnails = $state<Record<number, string>>({})

    $effect(() => {
        const toLoad = scenes.filter(
            (s) => s.thumbnailImageId && !thumbnails[s.id],
        )
        if (toLoad.length === 0) return
        for (const s of toLoad) loadThumbnail(s)
    })

    async function loadThumbnail(scene: Scene) {
        const { data } = await api.api.images.get({ query: { sceneId: scene.id } })
        if (data && data.length > 0) {
            const first = data[0]
            thumbnails = {
                ...thumbnails,
                [scene.id]: `${BASE_URL}/${first.thumbnailPath ?? first.filePath}`,
            }
        }
    }

    async function handleCreateScene(name: string) {
        const { data } = await api.api.scenes.post({ projectId, name })
        if (data) {
            scenes = [...scenes, data]
            onupdate?.()
        }
    }

    async function handleDeleteScene(scene: Scene) {
        await api.api.scenes({ id: scene.id }).delete()
        scenes = scenes.filter((s) => s.id !== scene.id)
        onupdate?.()
    }

    async function handleEnqueueScene(scene: Scene) {
        await api.api.queue.enqueue.post({ sceneId: scene.id })
    }

    async function handleDequeueScene(scene: Scene) {
        await api.api.queue.delete({ query: { sceneId: scene.id } })
    }

    function openEdit(scene: Scene) {
        editScene = scene
        editOpen = true
    }

    function openImages(scene: Scene) {
        imagesScene = scene
        imagesOpen = true
    }
</script>

<div class="flex h-full flex-col">
    <!-- Header -->
    <div class="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <span class="text-xs font-semibold uppercase text-muted-foreground">
            씬 ({scenes.length})
        </span>
        <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7"
            onclick={() => (createSceneOpen = true)}
        >
            <PlusIcon class="h-4 w-4" />
        </Button>
    </div>

    <ScrollArea.Root class="flex-1">
        {#if scenes.length === 0}
            <div class="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <ImageIcon class="mb-3 h-8 w-8 opacity-30" />
                <p class="text-sm">씬이 없습니다</p>
                <Button
                    variant="ghost"
                    size="sm"
                    class="mt-2 gap-1.5 text-xs"
                    onclick={() => (createSceneOpen = true)}
                >
                    <PlusIcon class="h-3.5 w-3.5" />
                    첫 씬 만들기
                </Button>
            </div>
        {:else}
            <!-- Gallery grid -->
            <div class="grid grid-cols-2 gap-3 p-3 lg:grid-cols-3">
                {#each scenes as scene (scene.id)}
                    <div class="group flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md">
                        <!-- Thumbnail area — click to view images -->
                        <button
                            class="relative aspect-[3/4] w-full overflow-hidden bg-muted"
                            onclick={() => openImages(scene)}
                            title="이미지 보기"
                        >
                            {#if thumbnails[scene.id]}
                                <img
                                    src={thumbnails[scene.id]}
                                    alt={scene.name}
                                    class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                />
                            {:else}
                                <div class="flex h-full w-full items-center justify-center">
                                    <ImageIcon class="h-8 w-8 text-muted-foreground/30" />
                                </div>
                            {/if}
                            <!-- Image count badge -->
                            <span
                                class="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm"
                            >
                                {scene.imageCount ?? 0}장
                            </span>
                        </button>

                        <!-- Info & actions -->
                        <div class="flex flex-col gap-2 p-2.5">
                            <div class="min-w-0">
                                <p class="truncate text-xs font-semibold">{scene.name}</p>
                                <p class="text-[10px] text-muted-foreground">
                                    변수 세트 {scene.variations?.length ?? 0}개
                                </p>
                            </div>

                            <!-- Action buttons -->
                            <div class="flex gap-1">
                                <button
                                    class="flex flex-1 items-center justify-center gap-1 rounded-md border py-1 text-[10px] hover:bg-accent"
                                    onclick={() => handleEnqueueScene(scene)}
                                    title="큐에 추가"
                                >
                                    <PlusCircleIcon class="h-3 w-3" />
                                    큐 추가
                                </button>
                                <button
                                    class="flex flex-1 items-center justify-center gap-1 rounded-md border py-1 text-[10px] hover:bg-accent"
                                    onclick={() => handleDequeueScene(scene)}
                                    title="큐에서 제거"
                                >
                                    <Trash2Icon class="h-3 w-3" />
                                    큐 삭제
                                </button>
                                <button
                                    class="flex flex-1 items-center justify-center gap-1 rounded-md border py-1 text-[10px] hover:bg-accent"
                                    onclick={() => openEdit(scene)}
                                    title="씬 수정"
                                >
                                    <SettingsIcon class="h-3 w-3" />
                                    수정
                                </button>
                            </div>

                            <!-- Delete -->
                            <button
                                class="w-full rounded-md py-0.5 text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onclick={() => {
                                    sceneToDelete = scene
                                    deleteOpen = true
                                }}
                            >
                                씬 삭제
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </ScrollArea.Root>
</div>

<CreateSceneDialog bind:open={createSceneOpen} oncreate={handleCreateScene} />

<ConfirmDeleteDialog
    bind:open={deleteOpen}
    title="씬 삭제"
    description={`"${sceneToDelete?.name}" 씬과 모든 이미지를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
    onconfirm={() => sceneToDelete && handleDeleteScene(sceneToDelete)}
/>

{#if editScene}
    <SceneEditDialog
        scene={editScene}
        bind:open={editOpen}
        onupdate={() => {
            onupdate?.()
        }}
    />
{/if}

{#if imagesScene}
    <SceneImagesDialog scene={imagesScene} bind:open={imagesOpen} />
{/if}
