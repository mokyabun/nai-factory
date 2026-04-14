<script lang="ts">
    import { api } from '$lib/api'
    import * as Dialog from '$lib/components/ui/dialog'
    import * as ScrollArea from '$lib/components/ui/scroll-area'
    import VariationEditor from './variation-editor.svelte'

    type Scene = NonNullable<Awaited<ReturnType<typeof api.api.scenes.get>>['data']>[number]
    type Variation = Record<string, string>

    let {
        scene,
        open = $bindable(false),
        onupdate,
    }: {
        scene: Scene
        open?: boolean
        onupdate?: () => void
    } = $props()

    let sceneName = $state(scene.name)
    let variations = $state<Variation[]>([...(scene.variations ?? [])])
    let saveTimeout: ReturnType<typeof setTimeout> | null = null
    let nameSaveTimeout: ReturnType<typeof setTimeout> | null = null

    $effect(() => {
        if (open) {
            sceneName = scene.name
            variations = [...(scene.variations ?? [])]
        }
    })

    function scheduleSave(v: Variation[]) {
        if (saveTimeout) clearTimeout(saveTimeout)
        saveTimeout = setTimeout(async () => {
            await api.api.scenes({ id: scene.id }).patch({ variations: v })
            onupdate?.()
        }, 800)
    }

    function handleVariationsChange(v: Variation[]) {
        variations = v
        scheduleSave(v)
    }

    function handleNameInput() {
        if (nameSaveTimeout) clearTimeout(nameSaveTimeout)
        nameSaveTimeout = setTimeout(async () => {
            const trimmed = sceneName.trim()
            if (trimmed && trimmed !== scene.name) {
                await api.api.scenes({ id: scene.id }).patch({ name: trimmed })
                onupdate?.()
            }
        }, 600)
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="flex max-h-[85vh] max-w-2xl flex-col gap-0 p-0">
        <Dialog.Header class="shrink-0 border-b px-6 py-4">
            <Dialog.Title class="text-base">씬 수정</Dialog.Title>
            <Dialog.Description class="sr-only">씬의 이름과 변수 세트를 수정합니다</Dialog.Description>
        </Dialog.Header>

        <ScrollArea.Root class="flex-1 overflow-hidden">
            <div class="flex flex-col gap-5 p-6">
                <!-- Scene name -->
                <div class="flex flex-col gap-1.5">
                    <label class="text-xs font-semibold uppercase text-muted-foreground">
                        씬 이름
                    </label>
                    <input
                        class="rounded-md border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                        bind:value={sceneName}
                        oninput={handleNameInput}
                        onkeydown={(e) => e.key === 'Enter' && (e.target as HTMLElement).blur()}
                    />
                </div>

                <!-- Variation editor -->
                <div class="flex flex-col gap-1.5">
                    <span class="text-xs font-semibold uppercase text-muted-foreground">
                        변수 세트 ({variations.length}개 → {variations.length}장 생성)
                    </span>
                    <VariationEditor bind:variations onchange={handleVariationsChange} />
                </div>
            </div>
        </ScrollArea.Root>
    </Dialog.Content>
</Dialog.Root>
