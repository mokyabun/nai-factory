<script lang="ts">
    import { Badge } from '$lib/components/ui/badge'
    import { CodeEditor } from '$lib/components/ui/code-editor'
    import { cn } from '$lib/utils'

    type Props = {
        class?: string
        prompt: string
        negativePrompt: string
    }

    let { class: className, prompt = $bindable(), negativePrompt = $bindable() }: Props = $props()
    let menu = $state<'base' | 'negative'>('base')
</script>

{#snippet promptTypeButton(type: 'base' | 'negative')}
    <Badge
        variant="secondary"
        class="cursor-pointer rounded-lg hover:bg-secondary hover:text-secondary-foreground {type !==
        menu
            ? 'bg-transparent text-secondary-foreground/50'
            : ''}"
        onclick={() => (menu = type)}
    >
        {type === 'base' ? '베이스 프롬프트' : '부정 프롬프트'}
    </Badge>
{/snippet}

<div class={cn('flex h-72 flex-col overflow-hidden rounded-md border border-input', className)}>
    <div class="flex h-9 shrink-0 items-center gap-2 border-b border-input px-3 select-none">
        {@render promptTypeButton('base')}
        {@render promptTypeButton('negative')}
    </div>

    <div class="min-h-0 flex-1">
        {#if menu === 'base'}
            <CodeEditor
                bind:value={prompt}
                placeholder="태그를 입력하세요..."
                class="h-full border-0 rounded-none"
            />
        {:else}
            <CodeEditor
                bind:value={negativePrompt}
                placeholder="부정 태그를 입력하세요..."
                class="h-full border-0 rounded-none"
            />
        {/if}
    </div>
</div>
