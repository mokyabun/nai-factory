<script lang="ts">
    import { useQueryClient } from '@tanstack/svelte-query'
    import { api } from '$lib/api'
    import { qk } from '$lib/queries'
    import { Button } from '$lib/components/ui/button'
    import { CodeEditor } from '$lib/components/ui/code-editor'
    import { Label } from '$lib/components/ui/label'
    import { Switch } from '$lib/components/ui/switch'
    import PlusIcon from '@lucide/svelte/icons/plus'
    import TrashIcon from '@lucide/svelte/icons/trash-2'

    type CharacterPrompt = {
        enabled: boolean
        center: { x: number; y: number }
        prompt: string
        uc: string
    }

    let {
        projectId,
        characterPrompts = $bindable<CharacterPrompt[]>([]),
        onchange,
    }: {
        projectId: number
        characterPrompts?: CharacterPrompt[]
        onchange?: (v: CharacterPrompt[]) => void
    } = $props()

    const queryClient = useQueryClient()

    function invalidateProject() {
        queryClient.invalidateQueries({ queryKey: qk.project(projectId) })
    }

    async function addCharacter() {
        const newChar: CharacterPrompt = {
            enabled: true,
            center: { x: 0, y: 0 },
            prompt: '',
            uc: '',
        }
        const { data } = await api.api.projects({ projectId })['character-prompts'].post(newChar)
        if (data !== undefined) {
            characterPrompts = [...characterPrompts, newChar]
            onchange?.(characterPrompts)
            invalidateProject()
        }
    }

    async function updateCharacter(index: number, updated: Partial<CharacterPrompt>) {
        const newPrompts = characterPrompts.map((cp, i) =>
            i === index ? { ...cp, ...updated } : cp,
        )
        characterPrompts = newPrompts
        await api.api.projects({ projectId })['character-prompts']({ index }).patch(updated)
        onchange?.(newPrompts)
        invalidateProject()
    }

    async function removeCharacter(index: number) {
        await api.api.projects({ projectId })['character-prompts']({ index }).delete()
        characterPrompts = characterPrompts.filter((_, i) => i !== index)
        onchange?.(characterPrompts)
        invalidateProject()
    }
</script>

<div class="flex flex-col gap-3">
    {#each characterPrompts as cp, i (i)}
        <div class="rounded-md border p-3">
            <div class="mb-3 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <Switch
                        checked={cp.enabled}
                        onCheckedChange={(v) => updateCharacter(i, { enabled: v })}
                        class="scale-75"
                    />
                    <span class="text-xs font-medium">캐릭터 {i + 1}</span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onclick={() => removeCharacter(i)}
                >
                    <TrashIcon class="h-3.5 w-3.5" />
                </Button>
            </div>

            <div class="flex flex-col gap-2">
                <div>
                    <Label class="text-xs">프롬프트</Label>
                    <CodeEditor
                        value={cp.prompt}
                        placeholder="캐릭터 프롬프트..."
                        class="mt-1"
                        minLines={3}
                        onchange={(v) => updateCharacter(i, { prompt: v })}
                    />
                </div>
                <div>
                    <Label class="text-xs">부정 프롬프트</Label>
                    <CodeEditor
                        value={cp.uc}
                        placeholder="부정 프롬프트..."
                        class="mt-1"
                        minLines={2}
                        onchange={(v) => updateCharacter(i, { uc: v })}
                    />
                </div>
            </div>
        </div>
    {:else}
        <div class="py-4 text-center text-xs text-muted-foreground">캐릭터 프롬프트 없음</div>
    {/each}

    <Button variant="outline" size="sm" class="gap-1.5" onclick={addCharacter}>
        <PlusIcon class="h-3.5 w-3.5" />
        캐릭터 추가
    </Button>
</div>
