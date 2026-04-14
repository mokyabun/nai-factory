<script lang="ts">
    import { Input } from '$lib/components/ui/input'
    import { Button } from '$lib/components/ui/button'
    import { CodeEditor } from '$lib/components/ui/code-editor'
    import PlusIcon from '@lucide/svelte/icons/plus'
    import TrashIcon from '@lucide/svelte/icons/trash-2'
    import XIcon from '@lucide/svelte/icons/x'

    type Variation = Record<string, string>

    let {
        variations = $bindable([]),
        onchange,
        layout = 'col',
    }: {
        variations?: Variation[]
        onchange?: (v: Variation[]) => void
        layout?: 'col' | 'row'
    } = $props()

    function addVariation() {
        variations = [...variations, {}]
        onchange?.(variations)
    }

    function removeVariation(i: number) {
        variations = variations.filter((_, idx) => idx !== i)
        onchange?.(variations)
    }

    function addKey(varIdx: number) {
        const updated = [...variations]
        updated[varIdx] = { ...updated[varIdx], '': '' }
        variations = updated
        onchange?.(variations)
    }

    function removeKey(varIdx: number, key: string) {
        const updated = [...variations]
        const { [key]: _, ...rest } = updated[varIdx]
        updated[varIdx] = rest
        variations = updated
        onchange?.(variations)
    }

    function updateKey(varIdx: number, oldKey: string, newKey: string) {
        const updated = [...variations]
        const obj = { ...updated[varIdx] }
        const value = obj[oldKey] ?? ''
        delete obj[oldKey]
        obj[newKey] = value
        updated[varIdx] = obj
        variations = updated
        onchange?.(variations)
    }

    function updateValue(varIdx: number, key: string, value: string) {
        const updated = [...variations]
        updated[varIdx] = { ...updated[varIdx], [key]: value }
        variations = updated
        onchange?.(variations)
    }
</script>

<div class="flex flex-col gap-3">
    <div class={layout === 'row' ? 'flex flex-nowrap gap-4' : 'flex flex-col gap-3'}>
        {#each variations as variation, varIdx (varIdx)}
        <div class="rounded-md border bg-card p-3 {layout === 'row' ? 'w-96 shrink-0' : ''}">
            <div class="mb-2 flex items-center justify-between">
                <span class="text-xs font-medium text-muted-foreground">변수 세트 {varIdx + 1}</span>
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onclick={() => removeVariation(varIdx)}
                >
                    <TrashIcon class="h-3.5 w-3.5" />
                </Button>
            </div>

            <div class="flex flex-col gap-2">
                {#each Object.entries(variation) as [key, value], keyIdx (keyIdx)}
                    <div class="flex flex-col gap-1">
                        <!-- Key row -->
                        <div class="flex items-center gap-1.5">
                            <Input
                                class="h-7 flex-1 px-2 font-mono text-xs"
                                value={key}
                                placeholder="변수명"
                                onblur={(e) =>
                                    updateKey(varIdx, key, (e.target as HTMLInputElement).value)}
                                onkeydown={(e) => {
                                    if (e.key === 'Enter')
                                        updateKey(varIdx, key, (e.target as HTMLInputElement).value)
                                }}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-6 w-6 shrink-0 text-muted-foreground"
                                onclick={() => removeKey(varIdx, key)}
                            >
                                <XIcon class="h-3 w-3" />
                            </Button>
                        </div>
                        <!-- Value editor -->
                        <CodeEditor
                            value={value}
                            placeholder="값 (태그, 프롬프트 등)..."
                            minLines={layout === 'row' ? 4 : 2}
                            onchange={(v) => updateValue(varIdx, key, v)}
                        />
                    </div>
                {/each}
            </div>

            <Button
                variant="ghost"
                size="sm"
                class="mt-2 h-6 w-full gap-1 text-xs text-muted-foreground"
                onclick={() => addKey(varIdx)}
            >
                <PlusIcon class="h-3 w-3" />
                변수 추가
            </Button>
        </div>
    {/each}
    </div>

    <Button variant="outline" size="sm" class="gap-1.5" onclick={addVariation}>
        <PlusIcon class="h-3.5 w-3.5" />
        변수 세트 추가
    </Button>
</div>
