<script lang="ts">
    import { Badge } from '$lib/components/ui/badge'
    import { cn } from '$lib/utils'

    type Props = {
        class?: string
        prompt: string
        negativePrompt: string
    }

    let { class: className, prompt = $bindable(), negativePrompt = $bindable() }: Props = $props()
    let menu = $state<'base' | 'negative'>('base')

    function handleMenuClick(type: 'base' | 'negative') {
        return () => (menu = type)
    }

    function handleInput(e: Event) {}
</script>

{#snippet promptTypeButton(type: 'base' | 'negative')}
    <Badge
        variant="secondary"
        class="rounded-lg hover:bg-secondary hover:text-secondary-foreground {type !== menu
            ? 'bg-transparent text-secondary-foreground/50'
            : ''}"
        onclick={handleMenuClick(type)}
    >
        {type === 'base' ? 'Base Prompt' : 'Negative Prompt'}
    </Badge>
{/snippet}

<div class={cn('flex h-72 flex-col rounded-md border border-input bg-background', className)}>
    <div class="mx-3 mt-3 flex h-8 items-center gap-2 select-none">
        <!-- <FurryAnimeTButton /> -->
        {@render promptTypeButton('base')}
        {@render promptTypeButton('negative')}
    </div>

    {#if menu === 'base'}
        <!-- base prompt -->
        <div
            role="textbox"
            tabindex="0"
            class="m-4 h-full resize-none overflow-y-auto text-sm outline-0"
            contenteditable="true"
            translate="no"
            bind:textContent={prompt}
            oninput={handleInput}
        ></div>
    {:else}
        <!-- negative prompt -->
        <div
            role="textbox"
            tabindex="0"
            class="m-4 h-full resize-none overflow-y-auto text-sm outline-0"
            contenteditable="true"
            translate="no"
            bind:textContent={negativePrompt}
            oninput={handleInput}
        ></div>
    {/if}
</div>
