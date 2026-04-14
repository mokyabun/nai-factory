<script lang="ts">
    import { untrack } from 'svelte'
    import { createMutation, useQueryClient } from '@tanstack/svelte-query'
    import { api } from '$lib/api'
    import { qk } from '$lib/queries'
    import * as Dialog from '$lib/components/ui/dialog'
    import { Button } from '$lib/components/ui/button'
    import { Input } from '$lib/components/ui/input'
    import VariationEditor from '$lib/components/app/project/variation-editor.svelte'

    type Variation = Record<string, string>
    type Scene = { id: number; projectId: number; name: string; variations: Variation[] | null }

    let {
        open = $bindable(false),
        scene,
    }: {
        open?: boolean
        scene: Scene
    } = $props()

    const queryClient = useQueryClient()

    let name = $state(untrack(() => scene.name))
    let variations = $state<Variation[]>(untrack(() => [...(scene.variations ?? [])]))
    let saving = $state(false)

    $effect(() => {
        name = scene.name
        variations = [...(scene.variations ?? [])]
    })

    async function handleSave() {
        saving = true
        await api.api.scenes({ id: scene.id }).patch({
            name: name.trim() || scene.name,
            variations,
        })
        saving = false
        open = false
        queryClient.invalidateQueries({ queryKey: qk.scenes(scene.projectId) })
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="flex h-[95dvh] flex-col gap-0 p-0" style="width: 95vw; max-width: none;">
        <Dialog.Header class="shrink-0 border-b px-6 py-4">
            <Dialog.Title>씬 수정</Dialog.Title>
            <Dialog.Description>씬 이름과 변수 세트를 수정합니다</Dialog.Description>
        </Dialog.Header>

        <!-- Scene name (fixed, no scroll) -->
        <div class="flex shrink-0 items-center gap-3 border-b px-6 py-3">
            <label class="shrink-0 text-sm font-medium">씬 이름</label>
            <Input bind:value={name} placeholder="씬 이름..." class="max-w-sm" />
        </div>

        <!-- Variations (scrollable both axes) -->
        <div class="min-h-0 flex-1 overflow-auto px-6 py-4">
            <div class="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                변수 세트 ({variations.length}개 → {variations.length}장 생성)
            </div>
            <VariationEditor bind:variations layout="row" />
        </div>

        <Dialog.Footer class="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onclick={() => (open = false)}>취소</Button>
            <Button onclick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
