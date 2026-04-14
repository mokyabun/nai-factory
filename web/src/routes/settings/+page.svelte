<script lang="ts">
    import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query'
    import { api } from '$lib/api'
    import { qk } from '$lib/queries'
    import { Button } from '$lib/components/ui/button'
    import { Input } from '$lib/components/ui/input'
    import { Label } from '$lib/components/ui/label'
    import * as Card from '$lib/components/ui/card'
    import * as Select from '$lib/components/ui/select'
    import EyeIcon from '@lucide/svelte/icons/eye'
    import EyeOffIcon from '@lucide/svelte/icons/eye-off'
    import PlusIcon from '@lucide/svelte/icons/plus'
    import XIcon from '@lucide/svelte/icons/x'
    import SaveIcon from '@lucide/svelte/icons/save'

    type ImageSaveType =
        | { type: 'png' }
        | { type: 'webp'; quality: number }
        | { type: 'avif'; quality: number }

    const queryClient = useQueryClient()

    const settingsQuery = createQuery(() => ({
        queryKey: qk.settings(),
        queryFn: async () => {
            const { data } = await api.api.settings.get()
            return data ?? null
        },
    }))

    // Local editable state
    let showApiKey = $state(false)
    let apiKey = $state('')
    let globalVars = $state<[string, string][]>([])
    let sourceFormat = $state<'png' | 'webp' | 'avif'>('png')
    let sourceQuality = $state(90)
    let thumbFormat = $state<'png' | 'webp' | 'avif'>('webp')
    let thumbQuality = $state(80)
    let thumbSize = $state(256)
    let loadedSettings = $state(false)

    // Sync from query on first load
    $effect(() => {
        const data = settingsQuery.data
        if (data && !loadedSettings) {
            loadedSettings = true
            apiKey = (data as any).novelai?.apiKey ?? ''
            globalVars = Object.entries((data as any).globalVariables ?? {})
            const settings = data as any
            sourceFormat = settings.image?.sourceType?.type ?? 'png'
            sourceQuality = settings.image?.sourceType?.quality ?? 90
            thumbFormat = settings.image?.thumbnailType?.type ?? 'webp'
            thumbQuality = settings.image?.thumbnailType?.quality ?? 80
            thumbSize = settings.image?.thumbnailSize ?? 256
        }
    })

    const saveSettings = createMutation(() => ({
        mutationFn: () => {
            const sourceType: ImageSaveType =
                sourceFormat === 'png'
                    ? { type: 'png' }
                    : { type: sourceFormat, quality: sourceQuality }
            const thumbnailType: ImageSaveType =
                thumbFormat === 'png'
                    ? { type: 'png' }
                    : { type: thumbFormat, quality: thumbQuality }

            return api.api.settings.patch({
                novelai: { apiKey },
                globalVariables: Object.fromEntries(globalVars),
                image: { sourceType, thumbnailType, thumbnailSize: thumbSize },
            })
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings() }),
    }))

    function addGlobalVar() {
        globalVars = [...globalVars, ['', '']]
    }

    function removeGlobalVar(i: number) {
        globalVars = globalVars.filter((_, idx) => idx !== i)
    }

    const IMAGE_FORMATS = [
        { value: 'png', label: 'PNG' },
        { value: 'webp', label: 'WebP' },
        { value: 'avif', label: 'AVIF' },
    ]
</script>

<div class="mx-auto flex h-full max-w-2xl flex-col gap-6 p-6">
    <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">설정</h1>
        <Button class="gap-1.5" disabled={saveSettings.isPending} onclick={() => saveSettings.mutate()}>
            <SaveIcon class="h-4 w-4" />
            {saveSettings.isPending ? '저장 중...' : '저장'}
        </Button>
    </div>

    {#if settingsQuery.isPending}
        <div class="text-center text-sm text-muted-foreground">불러오는 중...</div>
    {:else}
        <!-- NovelAI API Key -->
        <Card.Root>
            <Card.Header>
                <Card.Title class="text-base">NovelAI API Key</Card.Title>
                <Card.Description>이미지 생성에 사용할 NovelAI 계정의 API 키</Card.Description>
            </Card.Header>
            <Card.Content>
                <div class="relative">
                    <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        oninput={(e) => (apiKey = (e.target as HTMLInputElement).value)}
                        placeholder="API 키 입력..."
                        class="pr-10 font-mono text-sm"
                    />
                    <button
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onclick={() => (showApiKey = !showApiKey)}
                    >
                        {#if showApiKey}
                            <EyeOffIcon class="h-4 w-4" />
                        {:else}
                            <EyeIcon class="h-4 w-4" />
                        {/if}
                    </button>
                </div>
            </Card.Content>
        </Card.Root>

        <!-- Global Variables -->
        <Card.Root>
            <Card.Header>
                <Card.Title class="text-base">전역 변수</Card.Title>
                <Card.Description>모든 프로젝트 프롬프트에서 사용 가능한 변수</Card.Description>
            </Card.Header>
            <Card.Content>
                <div class="flex flex-col gap-2">
                    {#each globalVars as [key, value], i (i)}
                        <div class="flex items-center gap-2">
                            <Input
                                class="h-8 flex-1 font-mono text-xs"
                                value={key}
                                placeholder="변수명"
                                oninput={(e) =>
                                    (globalVars[i] = [
                                        (e.target as HTMLInputElement).value,
                                        globalVars[i][1],
                                    ])}
                            />
                            <span class="text-xs text-muted-foreground">=</span>
                            <Input
                                class="h-8 flex-1 text-xs"
                                value={value}
                                placeholder="값"
                                oninput={(e) =>
                                    (globalVars[i] = [
                                        globalVars[i][0],
                                        (e.target as HTMLInputElement).value,
                                    ])}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-8 w-8 shrink-0"
                                onclick={() => removeGlobalVar(i)}
                            >
                                <XIcon class="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    {/each}
                    <Button variant="outline" size="sm" class="gap-1.5 self-start" onclick={addGlobalVar}>
                        <PlusIcon class="h-3.5 w-3.5" />
                        변수 추가
                    </Button>
                </div>
            </Card.Content>
        </Card.Root>

        <!-- Image Settings -->
        <Card.Root>
            <Card.Header>
                <Card.Title class="text-base">이미지 저장 설정</Card.Title>
            </Card.Header>
            <Card.Content class="flex flex-col gap-4">
                <div class="grid grid-cols-2 gap-4">
                    <!-- Source format -->
                    <div class="flex flex-col gap-1.5">
                        <Label>원본 형식</Label>
                        <Select.Root
                            type="single"
                            value={sourceFormat}
                            onValueChange={(v) => (sourceFormat = v as 'png' | 'webp' | 'avif')}
                        >
                            <Select.Trigger class="w-full">
                                {IMAGE_FORMATS.find((f) => f.value === sourceFormat)?.label}
                            </Select.Trigger>
                            <Select.Content>
                                {#each IMAGE_FORMATS as f}
                                    <Select.Item value={f.value}>{f.label}</Select.Item>
                                {/each}
                            </Select.Content>
                        </Select.Root>
                        {#if sourceFormat !== 'png'}
                            <div class="flex items-center gap-2">
                                <Label class="text-xs">품질</Label>
                                <Input
                                    type="number"
                                    class="h-7 text-xs"
                                    value={sourceQuality}
                                    oninput={(e) =>
                                        (sourceQuality = Number(
                                            (e.target as HTMLInputElement).value,
                                        ))}
                                    min={1}
                                    max={100}
                                />
                            </div>
                        {/if}
                    </div>

                    <!-- Thumbnail format -->
                    <div class="flex flex-col gap-1.5">
                        <Label>썸네일 형식</Label>
                        <Select.Root
                            type="single"
                            value={thumbFormat}
                            onValueChange={(v) => (thumbFormat = v as 'png' | 'webp' | 'avif')}
                        >
                            <Select.Trigger class="w-full">
                                {IMAGE_FORMATS.find((f) => f.value === thumbFormat)?.label}
                            </Select.Trigger>
                            <Select.Content>
                                {#each IMAGE_FORMATS as f}
                                    <Select.Item value={f.value}>{f.label}</Select.Item>
                                {/each}
                            </Select.Content>
                        </Select.Root>
                        {#if thumbFormat !== 'png'}
                            <div class="flex items-center gap-2">
                                <Label class="text-xs">품질</Label>
                                <Input
                                    type="number"
                                    class="h-7 text-xs"
                                    value={thumbQuality}
                                    oninput={(e) =>
                                        (thumbQuality = Number(
                                            (e.target as HTMLInputElement).value,
                                        ))}
                                    min={1}
                                    max={100}
                                />
                            </div>
                        {/if}
                    </div>
                </div>

                <div class="flex flex-col gap-1.5">
                    <Label for="thumb-size">썸네일 크기 (px)</Label>
                    <Input
                        id="thumb-size"
                        type="number"
                        class="w-32"
                        value={thumbSize}
                        oninput={(e) =>
                            (thumbSize = Number((e.target as HTMLInputElement).value))}
                        min={64}
                        max={1024}
                    />
                </div>
            </Card.Content>
        </Card.Root>
    {/if}
</div>
