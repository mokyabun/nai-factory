<script lang="ts">
import { createSortable } from '@dnd-kit/svelte/sortable'
import { Check, DotsSixVertical, Trash, X } from 'phosphor-svelte'
import CodeEditor from '$lib/components/app/code-editor.svelte'
import { Button } from '$lib/components/ui/button'
import * as Tabs from '$lib/components/ui/tabs'
import { tagCompletionSource } from '$lib/tag-autocomplete'
import type { CharacterPrompt } from '$lib/types'

let {
    id,
    index,
    prompt,
    onUpdate,
    onRemove,
}: {
    id: number
    index: number
    prompt: CharacterPrompt
    onUpdate: (index: number, patch: Partial<CharacterPrompt>) => void
    onRemove: (index: number) => void
} = $props()

// svelte-ignore state_referenced_locally
const sortable = createSortable({ id, index, group: 'character-prompts' })
</script>

<div
	{@attach sortable.attach}
	class:opacity-40={sortable.isDragging}
	class:opacity-50={!sortable.isDragging && !prompt.enabled}
>
	<Tabs.Root value="prompt" class="flex flex-col overflow-hidden border">
		<Tabs.List class="my-1 w-full justify-between bg-transparent pr-2">
			<div class="flex items-center">
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					class="h-7 w-7 cursor-grab text-muted-foreground active:cursor-grabbing"
					{@attach sortable.attachHandle}
				>
					<DotsSixVertical class="h-3.5 w-3.5" />
				</Button>
				<Tabs.Trigger value="prompt" class="flex-1 text-xs">프롬프트</Tabs.Trigger>
				<Tabs.Trigger value="negative" class="flex-1 text-xs">부정 프롬프트</Tabs.Trigger>
			</div>
			<div>
				<Button
					variant="ghost"
					size="icon-xs"
					class="text-muted-foreground hover:text-primary"
					onclick={() => onUpdate(index, { enabled: !prompt.enabled })}
				>
					{#if prompt.enabled}
						<Check class="h-3.5 w-3.5" />
					{:else}
						<X class="h-3.5 w-3.5" />
					{/if}
				</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					class="text-muted-foreground hover:text-destructive"
					onclick={() => onRemove(index)}
				>
					<Trash class="h-3.5 w-3.5" />
				</Button>
			</div>
		</Tabs.List>
		<Tabs.Content value="prompt" class="flex-1 overflow-hidden">
			<CodeEditor
				value={prompt.prompt}
				placeholder="프롬프트를 입력하세요..."
				minLines={6}
				class="h-full"
				completionSource={tagCompletionSource}
				onChange={(value) => onUpdate(index, { prompt: value })}
			/>
		</Tabs.Content>
		<Tabs.Content value="negative" class="flex-1 overflow-hidden">
			<CodeEditor
				value={prompt.uc}
				placeholder="부정 프롬프트를 입력하세요..."
				minLines={6}
				class="h-full"
				completionSource={tagCompletionSource}
				onChange={(value) => onUpdate(index, { uc: value })}
			/>
		</Tabs.Content>
	</Tabs.Root>
</div>
