<script lang="ts">
    import PromptInput from './prompt/prompt-editor.svelte'
    import { Label } from '$lib/components/ui/label'
    import PromptSelector from './prompt/prompt-selector.svelte'
    import SettingsIcon from '@lucide/svelte/icons/settings'
    import FactoryIcon from '@lucide/svelte/icons/factory'

    let prompt = $state('')
    let negativePrompt = $state('')
    let menu = $state<'prompt' | 'variables' | 'vibes'>('prompt')

    let project = $state({
        name: '새 프로젝트',
    })
</script>

<div class="relative flex h-screen flex-col gap-[1px] p-4">
    <div class="flex h-12 items-center justify-between gap-[1px]">
        <a class="flex h-12 w-12 items-center justify-center bg-background" href="/">
            <FactoryIcon class="mx-3 h-6 w-6" />
        </a>
        <div class="flex h-full w-full items-center justify-center bg-background/70 outline-0">
            <div
                bind:textContent={project.name}
                contenteditable
                translate="no"
                class="flex-1 text-center text-lg font-semibold outline-0"
            ></div>
        </div>
        <div class="flex h-12 w-12 items-center justify-center bg-background/70">
            <SettingsIcon class="mx-3 h-6 w-6" />
        </div>
    </div>

    <Label class="mb-2 font-extralight">프롬프트</Label>
    <PromptSelector bind:menu />
    <PromptInput bind:prompt bind:negativePrompt />
</div>
