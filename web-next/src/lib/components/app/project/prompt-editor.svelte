<script lang="ts">
import CodeEditor from '$lib/components/app/code-editor.svelte'
import * as Tabs from '$lib/components/ui/tabs'
import { tagCompletionSource } from '$lib/tag-autocomplete'
import { cn } from '$lib/utils'

let {
    prompt = $bindable(''),
    negativePrompt = $bindable(''),
    class: className,
    onPromptChange,
    onNegativePromptChange,
}: {
    prompt?: string
    negativePrompt?: string
    class?: string
    onPromptChange?: (value: string) => void
    onNegativePromptChange?: (value: string) => void
} = $props()

let tab = $state('prompt')
</script>

<Tabs.Root bind:value={tab} class={cn('flex flex-col overflow-hidden border', className)}>
	<Tabs.List class="m-1 bg-transparent">
		<Tabs.Trigger value="prompt" class="flex-1 text-xs">프롬프트</Tabs.Trigger>
		<Tabs.Trigger value="negative" class="flex-1 text-xs">부정 프롬프트</Tabs.Trigger>
	</Tabs.List>
	<Tabs.Content value="prompt" class="flex-1 overflow-hidden">
		<CodeEditor
			bind:value={prompt}
			placeholder="프롬프트를 입력하세요..."
			minLines={6}
			class="h-full"
			completionSource={tagCompletionSource}
			onChange={onPromptChange}
		/>
	</Tabs.Content>
	<Tabs.Content value="negative" class="flex-1 overflow-hidden">
		<CodeEditor
			bind:value={negativePrompt}
			placeholder="부정 프롬프트를 입력하세요..."
			minLines={6}
			class="h-full"
			completionSource={tagCompletionSource}
			onChange={onNegativePromptChange}
		/>
	</Tabs.Content>
</Tabs.Root>
