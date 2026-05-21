<script lang="ts">
import { Plus, Trash, X } from 'phosphor-svelte'
import CodeEditor from '$lib/components/app/code-editor.svelte'
import { Button } from '$lib/components/ui/button'
import { Input } from '$lib/components/ui/input'

type Variation = Record<string, string>

let {
    variations = $bindable<Variation[]>([]),
    layout = 'col',
    onChange,
}: {
    variations?: Variation[]
    layout?: 'col' | 'row'
    onChange?: (variations: Variation[]) => void
} = $props()

function commit(next: Variation[]) {
    variations = next
    onChange?.(next)
}

function addVariation() {
    commit([...variations, {}])
}

function removeVariation(index: number) {
    commit(variations.filter((_, i) => i !== index))
}

function addKey(variationIndex: number) {
    const next = [...variations]
    next[variationIndex] = { ...next[variationIndex], '': '' }
    commit(next)
}

function removeKey(variationIndex: number, key: string) {
    const next = [...variations]
    const { [key]: _, ...rest } = next[variationIndex]
    next[variationIndex] = rest
    commit(next)
}

function updateKey(variationIndex: number, oldKey: string, newKey: string) {
    const next = [...variations]
    const obj = { ...next[variationIndex] }
    const value = obj[oldKey] ?? ''
    delete obj[oldKey]
    obj[newKey] = value
    next[variationIndex] = obj
    commit(next)
}

function updateValue(variationIndex: number, key: string, value: string) {
    const next = [...variations]
    next[variationIndex] = { ...next[variationIndex], [key]: value }
    commit(next)
}
</script>

<div class="flex flex-col gap-3">
	<div class={layout === 'row' ? 'flex flex-nowrap gap-4' : 'flex flex-col gap-3'}>
		{#each variations as variation, variationIndex (variationIndex)}
			<div class={`rounded-md border bg-card p-3 ${layout === 'row' ? 'w-96 shrink-0' : ''}`}>
				<div class="mb-2 flex items-center justify-between">
					<span class="text-xs font-medium text-muted-foreground">변수 세트 {variationIndex + 1}</span>
					<Button
						variant="ghost"
						size="icon-xs"
						class="h-6 w-6 text-muted-foreground hover:text-destructive"
						onclick={() => removeVariation(variationIndex)}
					>
						<Trash class="h-3.5 w-3.5" />
					</Button>
				</div>

				<div class="flex flex-col gap-2">
					{#each Object.entries(variation) as [key, value], keyIndex (keyIndex)}
						<div class="flex flex-col gap-1">
							<div class="flex items-center gap-1.5">
								<Input
									class="h-7 flex-1 px-2 font-mono text-xs"
									value={key}
									placeholder="변수명"
									onblur={(event) => updateKey(variationIndex, key, event.currentTarget.value)}
									onkeydown={(event) => {
										if (event.key === 'Enter') updateKey(variationIndex, key, event.currentTarget.value)
									}}
								/>
								<Button
									variant="ghost"
									size="icon-xs"
									class="h-6 w-6 shrink-0 text-muted-foreground"
									onclick={() => removeKey(variationIndex, key)}
								>
									<X class="h-3 w-3" />
								</Button>
							</div>
							<CodeEditor
								{value}
								placeholder="값 (태그, 프롬프트 등)..."
								minLines={layout === 'row' ? 4 : 2}
								onChange={(next) => updateValue(variationIndex, key, next)}
							/>
						</div>
					{/each}
				</div>

				<Button
					variant="ghost"
					size="sm"
					class="mt-2 h-6 w-full gap-1 text-xs text-muted-foreground"
					onclick={() => addKey(variationIndex)}
				>
					<Plus class="h-3 w-3" />
					변수 추가
				</Button>
			</div>
		{/each}
	</div>

	<Button variant="outline" size="sm" class="gap-1.5" onclick={addVariation}>
		<Plus class="h-3.5 w-3.5" />
		변수 세트 추가
	</Button>
</div>
