<script lang="ts">
import { createMutation, useQueryClient } from '@tanstack/svelte-query'
import CharacterPromptEditor from './character-prompt-editor.svelte'
import VibeTransferEditor from './vibe-transfer-editor.svelte'
import { Button } from '$lib/components/ui/button'
import { Input } from '$lib/components/ui/input'
import { Label } from '$lib/components/ui/label'
import * as NativeSelect from '$lib/components/ui/native-select'
import * as Sheet from '$lib/components/ui/sheet'
import { Slider } from '$lib/components/ui/slider'
import { Switch } from '$lib/components/ui/switch'
import * as Tabs from '$lib/components/ui/tabs'
import { api } from '$lib/api'
import { qk } from '$lib/query-keys'
import type { ProjectData, ProjectParams } from '$lib/types'

let { open = $bindable(false), project }: { open?: boolean; project: ProjectData } = $props()
const queryClient = useQueryClient()
// svelte-ignore state_referenced_locally
let params = $state<ProjectParams>({ ...project.parameters })
let activeTab = $state('params')

$effect(() => {
    params = { ...project.parameters }
})

const saveParams = createMutation(() => ({
    mutationFn: () => api.projects({ projectId: project.id }).patch({ parameters: params }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.project(project.id) })
        open = false
    },
}))

const models = [
    { value: 'nai-diffusion-4-5-full', label: 'NAI Diffusion 4.5 Full' },
    { value: 'nai-diffusion-4-5-curated', label: 'NAI Diffusion 4.5 Curated' },
    { value: 'nai-diffusion-4-full', label: 'NAI Diffusion 4 Full' },
    { value: 'nai-diffusion-4-curated', label: 'NAI Diffusion 4 Curated' },
]
const samplers = [
    { value: 'k_euler_ancestral', label: 'Euler Ancestral' },
    { value: 'k_euler', label: 'Euler' },
    { value: 'k_dpmpp_2s_ancestral', label: 'DPM++ 2S Ancestral' },
    { value: 'k_dpmpp_2m', label: 'DPM++ 2M' },
    { value: 'k_dpmpp_sde', label: 'DPM++ SDE' },
    { value: 'k_dpmpp_2m_sde', label: 'DPM++ 2M SDE' },
    { value: 'dimm_v3', label: 'DIMM v3' },
]
const noiseSchedules = [
    { value: 'native', label: 'Native' },
    { value: 'karras', label: 'Karras' },
    { value: 'exponential', label: 'Exponential' },
    { value: 'polyexponential', label: 'Polyexponential' },
]

function setParam<K extends keyof ProjectParams>(key: K, value: ProjectParams[K]) {
    params = { ...params, [key]: value }
}
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" class="flex w-[400px] flex-col overflow-hidden sm:max-w-none">
		<Sheet.Header class="shrink-0">
			<Sheet.Title>프로젝트 설정</Sheet.Title>
			<Sheet.Description>파라미터, 바이브 이미지, 캐릭터 레퍼런스를 관리합니다</Sheet.Description>
		</Sheet.Header>

		<Tabs.Root bind:value={activeTab} class="flex min-h-0 flex-1 flex-col gap-0">
			<Tabs.List class="mx-4 w-[calc(100%-2rem)] shrink-0">
				<Tabs.Trigger value="params">파라미터</Tabs.Trigger>
				<Tabs.Trigger value="vibe">바이브 이미지</Tabs.Trigger>
				<Tabs.Trigger value="character">캐릭터 레퍼런스</Tabs.Trigger>
			</Tabs.List>

			<div class="min-h-0 flex-1 overflow-y-auto px-4">
				<Tabs.Content value="params" class="mt-0 flex flex-col gap-5 py-4">
					<div class="flex flex-col gap-1.5">
						<Label>모델</Label>
						<NativeSelect.Root
							value={params.model}
							class="w-full"
							onchange={(event) => setParam('model', event.currentTarget.value)}
						>
							{#each models as model}
								<NativeSelect.Option value={model.value}>{model.label}</NativeSelect.Option>
							{/each}
						</NativeSelect.Root>
					</div>

					<div class="flex gap-3">
						<div class="flex flex-1 flex-col gap-1.5">
							<Label for="width">너비</Label>
							<Input
								id="width"
								type="number"
								value={params.width}
								min={64}
								max={2048}
								step={64}
								oninput={(event) => setParam('width', Number(event.currentTarget.value))}
							/>
						</div>
						<div class="flex flex-1 flex-col gap-1.5">
							<Label for="height">높이</Label>
							<Input
								id="height"
								type="number"
								value={params.height}
								min={64}
								max={2048}
								step={64}
								oninput={(event) => setParam('height', Number(event.currentTarget.value))}
							/>
						</div>
					</div>

					{@render NumberSlider({ label: '스텝', value: params.steps, min: 1, max: 50, step: 1, onChange: (value) => setParam('steps', value) })}
					{@render NumberSlider({ label: 'CFG Scale', value: params.promptGuidance, min: 1, max: 10, step: 0.1, onChange: (value) => setParam('promptGuidance', value) })}
					{@render NumberSlider({ label: 'CFG Rescale', value: params.promptGuidanceRescale, min: 0, max: 1, step: 0.01, onChange: (value) => setParam('promptGuidanceRescale', value) })}

					<div class="flex flex-col gap-1.5">
						<Label for="seed">시드 (0 = 랜덤)</Label>
						<Input
							id="seed"
							type="number"
							value={params.seed}
							min={0}
							oninput={(event) => setParam('seed', Number(event.currentTarget.value))}
						/>
					</div>

					{@render SelectRow({ label: '샘플러', value: params.sampler, items: samplers, onChange: (value) => setParam('sampler', value) })}
					{@render SelectRow({ label: '노이즈 스케줄', value: params.noiseSchedule, items: noiseSchedules, onChange: (value) => setParam('noiseSchedule', value) })}

					<div class="flex flex-col gap-3">
						{@render ToggleRow({ label: 'Quality Toggle', checked: params.qualityToggle, onChange: (value) => setParam('qualityToggle', value) })}
						{@render ToggleRow({ label: 'Variety+', checked: params.varietyPlus, onChange: (value) => setParam('varietyPlus', value) })}
						{@render ToggleRow({ label: '캐릭터 위치 사용', checked: params.useCharacterPositions, onChange: (value) => setParam('useCharacterPositions', value) })}
					</div>
				</Tabs.Content>
				<Tabs.Content value="vibe" class="mt-0 py-4">
					<VibeTransferEditor projectId={project.id} />
				</Tabs.Content>
				<Tabs.Content value="character" class="mt-0 py-4">
					<CharacterPromptEditor projectId={project.id} characterPrompts={project.characterPrompts ?? []} />
				</Tabs.Content>
			</div>
		</Tabs.Root>

		<Sheet.Footer class="shrink-0">
			<Button variant="outline" onclick={() => (open = false)}>닫기</Button>
			{#if activeTab === 'params'}
				<Button onclick={() => saveParams.mutate()} disabled={saveParams.isPending}>저장</Button>
			{/if}
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>

{#snippet NumberSlider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void })}
	<div class="flex flex-col gap-2">
		<div class="flex items-center justify-between">
			<Label>{label}</Label>
			<span class="text-sm text-muted-foreground">{value}</span>
		</div>
		<Slider type="single" {value} {min} {max} {step} onValueChange={(next: number) => onChange(next)} />
	</div>
{/snippet}

{#snippet SelectRow({ label, value, items, onChange }: { label: string; value: string; items: { value: string; label: string }[]; onChange: (value: string) => void })}
	<div class="flex flex-col gap-1.5">
		<Label>{label}</Label>
		<NativeSelect.Root
			{value}
			class="w-full"
			onchange={(event) => onChange(event.currentTarget.value)}
		>
			{#each items as item}
				<NativeSelect.Option value={item.value}>{item.label}</NativeSelect.Option>
			{/each}
		</NativeSelect.Root>
	</div>
{/snippet}

{#snippet ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void })}
	<div class="flex items-center justify-between">
		<Label>{label}</Label>
		<Switch {checked} onCheckedChange={onChange} />
	</div>
{/snippet}
