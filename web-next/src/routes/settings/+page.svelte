<script lang="ts">
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { Eye, EyeSlash, FloppyDisk, Plus, X } from 'phosphor-svelte'
import { Button } from '$lib/components/ui/button'
import * as Card from '$lib/components/ui/card'
import { Input } from '$lib/components/ui/input'
import { Label } from '$lib/components/ui/label'
import * as NativeSelect from '$lib/components/ui/native-select'
import { api } from '$lib/api'
import { qk } from '$lib/query-keys'
import type { ImageSaveType, Settings } from '$lib/types'

const queryClient = useQueryClient()
const imageFormats = [
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' },
    { value: 'avif', label: 'AVIF' },
]

const settingsQuery = createQuery(() => ({
    queryKey: qk.settings(),
    queryFn: async () => {
        const { data } = await api.settings.get()
        return (data ?? null) as Settings | null
    },
}))

let showApiKey = $state(false)
let apiKey = $state('')
let globalVars = $state<[string, string][]>([])
let sourceFormat = $state<'png' | 'webp' | 'avif'>('png')
let sourceQuality = $state(90)
let thumbFormat = $state<'png' | 'webp' | 'avif'>('webp')
let thumbQuality = $state(80)
let thumbSize = $state(256)
let loaded = $state(false)

$effect(() => {
    const data = settingsQuery.data
    if (!data || loaded) return
    loaded = true
    apiKey = data.novelai?.apiKey ?? ''
    globalVars = Object.entries(data.globalVariables ?? {})
    sourceFormat = data.image?.sourceType?.type ?? 'png'
    sourceQuality =
        data.image?.sourceType?.type === 'png' ? 90 : (data.image?.sourceType?.quality ?? 90)
    thumbFormat = data.image?.thumbnailType?.type ?? 'webp'
    thumbQuality =
        data.image?.thumbnailType?.type === 'png' ? 80 : (data.image?.thumbnailType?.quality ?? 80)
    thumbSize = data.image?.thumbnailSize ?? 256
})

const saveSettings = createMutation(() => ({
    mutationFn: () => {
        const sourceType: ImageSaveType =
            sourceFormat === 'png'
                ? { type: 'png' }
                : { type: sourceFormat, quality: sourceQuality }
        const thumbnailType: ImageSaveType =
            thumbFormat === 'png' ? { type: 'png' } : { type: thumbFormat, quality: thumbQuality }

        return api.settings.patch({
            novelai: { apiKey },
            globalVariables: Object.fromEntries(globalVars),
            image: { sourceType, thumbnailType, thumbnailSize: thumbSize },
        })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings() }),
}))
</script>

<div class="mx-auto flex h-full max-w-2xl flex-col gap-6 p-6">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold">설정</h1>
		<Button class="gap-1.5" disabled={saveSettings.isPending} onclick={() => saveSettings.mutate()}>
			<FloppyDisk class="h-4 w-4" />
			{saveSettings.isPending ? '저장 중...' : '저장'}
		</Button>
	</div>

	{#if settingsQuery.isPending}
		<div class="text-center text-sm text-muted-foreground">불러오는 중...</div>
	{:else}
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">NovelAI API Key</Card.Title>
				<Card.Description>이미지 생성에 사용할 NovelAI 계정의 API 키</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="relative">
					<Input
						type={showApiKey ? 'text' : 'password'}
						bind:value={apiKey}
						placeholder="API 키 입력..."
						class="pr-10 font-mono text-sm"
					/>
					<button
						class="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						onclick={() => (showApiKey = !showApiKey)}
						type="button"
					>
						{#if showApiKey}
							<EyeSlash class="h-4 w-4" />
						{:else}
							<Eye class="h-4 w-4" />
						{/if}
					</button>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">전역 변수</Card.Title>
				<Card.Description>모든 프로젝트 프롬프트에서 사용 가능한 변수</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="flex flex-col gap-2">
					{#each globalVars as [key, value], index (index)}
						<div class="flex items-center gap-2">
							<Input
								class="h-8 flex-1 font-mono text-xs"
								value={key}
								placeholder="변수명"
								oninput={(event) =>
									(globalVars = globalVars.map((item, i) =>
										i === index ? [event.currentTarget.value, item[1]] : item
									))}
							/>
							<span class="text-xs text-muted-foreground">=</span>
							<Input
								class="h-8 flex-1 text-xs"
								value={value}
								placeholder="값"
								oninput={(event) =>
									(globalVars = globalVars.map((item, i) =>
										i === index ? [item[0], event.currentTarget.value] : item
									))}
							/>
							<Button
								variant="ghost"
								size="icon"
								class="h-8 w-8 shrink-0"
								onclick={() => (globalVars = globalVars.filter((_, i) => i !== index))}
							>
								<X class="h-3.5 w-3.5" />
							</Button>
						</div>
					{/each}
					<Button
						variant="outline"
						size="sm"
						class="gap-1.5 self-start"
						onclick={() => (globalVars = [...globalVars, ['', '']])}
					>
						<Plus class="h-3.5 w-3.5" />
						변수 추가
					</Button>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title class="text-base">이미지 저장 설정</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<div class="grid grid-cols-2 gap-4">
					{@render FormatControl({
						label: '원본 형식',
						format: sourceFormat,
						quality: sourceQuality,
						formats: imageFormats,
						onFormat: (value) => (sourceFormat = value),
						onQuality: (value) => (sourceQuality = value),
					})}
					{@render FormatControl({
						label: '썸네일 형식',
						format: thumbFormat,
						quality: thumbQuality,
						formats: imageFormats,
						onFormat: (value) => (thumbFormat = value),
						onQuality: (value) => (thumbQuality = value),
					})}
				</div>

				<div class="flex flex-col gap-1.5">
					<Label for="thumb-size">썸네일 크기 (px)</Label>
					<Input
						id="thumb-size"
						type="number"
						class="w-32"
						bind:value={thumbSize}
						min={64}
						max={1024}
					/>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</div>

{#snippet FormatControl({
	label,
	format,
	quality,
	formats,
	onFormat,
	onQuality,
}: {
	label: string
	format: 'png' | 'webp' | 'avif'
	quality: number
	formats: { value: string; label: string }[]
	onFormat: (value: 'png' | 'webp' | 'avif') => void
	onQuality: (value: number) => void
})}
	<div class="flex flex-col gap-1.5">
		<Label>{label}</Label>
		<NativeSelect.Root
			value={format}
			class="w-full"
			onchange={(event) => onFormat(event.currentTarget.value as 'png' | 'webp' | 'avif')}
		>
			{#each formats as item}
				<NativeSelect.Option value={item.value}>{item.label}</NativeSelect.Option>
			{/each}
		</NativeSelect.Root>
		{#if format !== 'png'}
			<div class="flex items-center gap-2">
				<Label class="text-xs">품질</Label>
				<Input
					type="number"
					class="h-7 text-xs"
					value={quality}
					min={1}
					max={100}
					oninput={(event) => onQuality(Number(event.currentTarget.value))}
				/>
			</div>
		{/if}
	</div>
{/snippet}
