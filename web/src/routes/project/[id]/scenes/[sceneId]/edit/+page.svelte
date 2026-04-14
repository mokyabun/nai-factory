<script lang="ts">
    import { page } from '$app/state'
    import { goto } from '$app/navigation'
    import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query'
    import { api } from '$lib/api'
    import { qk } from '$lib/queries'
    import { Button } from '$lib/components/ui/button'
    import { Input } from '$lib/components/ui/input'
    import VariationEditor from '$lib/components/app/project/variation-editor.svelte'
    import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left'
    import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
    import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'

    type Variation = Record<string, string>

    const projectId = $derived(+page.params.id)
    const sceneId = $derived(+page.params.sceneId)

    const queryClient = useQueryClient()

    const scenesQuery = createQuery(() => ({
        queryKey: qk.scenes(projectId),
        queryFn: async () => {
            const { data } = await api.api.scenes.get({ query: { projectId } })
            return data ?? []
        },
        enabled: projectId > 0,
    }))

    const scenes = $derived(scenesQuery.data ?? [])
    const currentIndex = $derived(scenes.findIndex((s) => s.id === sceneId))
    const scene = $derived(currentIndex >= 0 ? scenes[currentIndex] : null)
    const prevScene = $derived(currentIndex > 0 ? scenes[currentIndex - 1] : null)
    const nextScene = $derived(currentIndex < scenes.length - 1 ? scenes[currentIndex + 1] : null)

    let name = $state('')
    let variations = $state<Variation[]>([])
    let saving = $state(false)
    let initialized = $state(false)

    $effect(() => {
        if (scene && !initialized) {
            name = scene.name
            variations = [...(scene.variations ?? [])]
            initialized = true
        }
    })

    // Re-initialize when scene changes (prev/next navigation)
    $effect(() => {
        sceneId  // track
        initialized = false
    })

    const saveScene = createMutation(() => ({
        mutationFn: () =>
            api.api.scenes({ id: sceneId }).patch({
                name: name.trim() || (scene?.name ?? ''),
                variations,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.scenes(projectId) })
            history.back()
        },
    }))

    function navigateTo(targetId: number) {
        goto(`/project/${projectId}/scenes/${targetId}/edit`, { replaceState: false })
    }
</script>

<div class="flex h-dvh flex-col">
    <!-- Header -->
    <div class="flex shrink-0 items-center gap-3 border-b px-6 py-4">
        <Button variant="ghost" size="icon-sm" onclick={() => history.back()}>
            <ArrowLeftIcon class="h-4 w-4" />
        </Button>
        <div class="flex-1">
            <h1 class="text-base font-semibold">{scene?.name ?? '로딩 중...'}</h1>
            <p class="text-xs text-muted-foreground">씬 수정</p>
        </div>
        <!-- Scene prev/next navigation -->
        <div class="flex items-center gap-1 text-xs text-muted-foreground">
            {#if scenes.length > 0}
                <span>{currentIndex + 1} / {scenes.length}</span>
            {/if}
            <Button
                variant="ghost"
                size="icon-sm"
                disabled={!prevScene}
                onclick={() => prevScene && navigateTo(prevScene.id)}
                title="이전 씬"
            >
                <ChevronLeftIcon class="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon-sm"
                disabled={!nextScene}
                onclick={() => nextScene && navigateTo(nextScene.id)}
                title="다음 씬"
            >
                <ChevronRightIcon class="h-4 w-4" />
            </Button>
        </div>
    </div>

    <!-- Scene name -->
    <div class="flex shrink-0 items-center gap-3 border-b px-6 py-3">
        <label class="shrink-0 text-sm font-medium">씬 이름</label>
        <Input bind:value={name} placeholder="씬 이름..." class="max-w-sm" />
    </div>

    <!-- Variations -->
    <div class="min-h-0 flex-1 overflow-auto px-6 py-4">
        <div class="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            변수 세트 ({variations.length}개 → {variations.length}장 생성)
        </div>
        <VariationEditor bind:variations layout="row" />
    </div>

    <!-- Footer -->
    <div class="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
        <Button variant="outline" onclick={() => history.back()}>취소</Button>
        <Button onclick={() => saveScene.mutate()} disabled={saveScene.isPending || !scene}>
            {saveScene.isPending ? '저장 중...' : '저장'}
        </Button>
    </div>
</div>
