<script lang="ts">
    import { untrack } from 'svelte'
    import { createMutation, useQueryClient } from '@tanstack/svelte-query'
    import { api } from '$lib/api'
    import { qk } from '$lib/queries'
    import * as Sheet from '$lib/components/ui/sheet'
    import { Button } from '$lib/components/ui/button'
    import { Input } from '$lib/components/ui/input'
    import { Label } from '$lib/components/ui/label'
    import { Switch } from '$lib/components/ui/switch'
    import * as Select from '$lib/components/ui/select'
    import * as Slider from '$lib/components/ui/slider'

    type ProjectData = {
        id: number
        parameters: {
            model: string
            qualityToggle: boolean
            width: number
            height: number
            steps: number
            promptGuidance: number
            varietyPlus: boolean
            seed: number
            sampler: string
            promptGuidanceRescale: number
            noiseSchedule: string
            normalizeReferenceStrengthValues: boolean
            useCharacterPositions: boolean
        }
    }

    let {
        open = $bindable(false),
        project,
    }: {
        open?: boolean
        project: ProjectData
    } = $props()

    const queryClient = useQueryClient()

    let params = $state(untrack(() => ({ ...project.parameters })))

    $effect(() => {
        params = { ...project.parameters }
    })

    const MODELS = [
        { value: 'nai-diffusion-4-5-full', label: 'NAI Diffusion 4.5 Full' },
        { value: 'nai-diffusion-4-5-curated', label: 'NAI Diffusion 4.5 Curated' },
        { value: 'nai-diffusion-4-full', label: 'NAI Diffusion 4 Full' },
        { value: 'nai-diffusion-4-curated', label: 'NAI Diffusion 4 Curated' },
    ]

    const SAMPLERS = [
        { value: 'k_euler_ancestral', label: 'Euler Ancestral' },
        { value: 'k_euler', label: 'Euler' },
        { value: 'k_dpmpp_2s_ancestral', label: 'DPM++ 2S Ancestral' },
        { value: 'k_dpmpp_2m', label: 'DPM++ 2M' },
        { value: 'k_dpmpp_sde', label: 'DPM++ SDE' },
        { value: 'k_dpmpp_2m_sde', label: 'DPM++ 2M SDE' },
        { value: 'dimm_v3', label: 'DIMM v3' },
    ]

    const NOISE_SCHEDULES = [
        { value: 'native', label: 'Native' },
        { value: 'karras', label: 'Karras' },
        { value: 'exponential', label: 'Exponential' },
        { value: 'polyexponential', label: 'Polyexponential' },
    ]

    const saveParams = createMutation(() => ({
        mutationFn: () =>
            api.api.projects({ projectId: project.id }).patch({ parameters: params as any }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.project(project.id) })
            open = false
        },
    }))
</script>

<Sheet.Root bind:open>
    <Sheet.Content side="right" class="w-[360px] overflow-y-auto sm:max-w-none">
        <Sheet.Header>
            <Sheet.Title>생성 파라미터</Sheet.Title>
            <Sheet.Description>이미지 생성에 사용할 설정을 변경합니다</Sheet.Description>
        </Sheet.Header>

        <div class="flex flex-col gap-5 py-4">
            <!-- Model -->
            <div class="flex flex-col gap-1.5">
                <Label>모델</Label>
                <Select.Root
                    type="single"
                    value={params.model}
                    onValueChange={(v) => (params.model = v)}
                >
                    <Select.Trigger class="w-full">
                        {MODELS.find((m) => m.value === params.model)?.label ?? params.model}
                    </Select.Trigger>
                    <Select.Content>
                        {#each MODELS as m}
                            <Select.Item value={m.value}>{m.label}</Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>

            <!-- Size -->
            <div class="flex gap-3">
                <div class="flex flex-1 flex-col gap-1.5">
                    <Label for="width">너비</Label>
                    <Input
                        id="width"
                        type="number"
                        value={params.width}
                        oninput={(e) => (params.width = Number((e.target as HTMLInputElement).value))}
                        min={64}
                        max={2048}
                        step={64}
                    />
                </div>
                <div class="flex flex-1 flex-col gap-1.5">
                    <Label for="height">높이</Label>
                    <Input
                        id="height"
                        type="number"
                        value={params.height}
                        oninput={(e) =>
                            (params.height = Number((e.target as HTMLInputElement).value))}
                        min={64}
                        max={2048}
                        step={64}
                    />
                </div>
            </div>

            <!-- Steps -->
            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <Label>스텝</Label>
                    <span class="text-sm text-muted-foreground">{params.steps}</span>
                </div>
                <Slider.Root
                    type="single"
                    value={params.steps}
                    min={1}
                    max={50}
                    step={1}
                    onValueChange={(v) => (params.steps = v)}
                />
            </div>

            <!-- Prompt Guidance (CFG) -->
            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <Label>CFG Scale</Label>
                    <span class="text-sm text-muted-foreground">{params.promptGuidance}</span>
                </div>
                <Slider.Root
                    type="single"
                    value={params.promptGuidance}
                    min={1}
                    max={10}
                    step={0.1}
                    onValueChange={(v) => (params.promptGuidance = v)}
                />
            </div>

            <!-- CFG Rescale -->
            <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <Label>CFG Rescale</Label>
                    <span class="text-sm text-muted-foreground">{params.promptGuidanceRescale}</span>
                </div>
                <Slider.Root
                    type="single"
                    value={params.promptGuidanceRescale}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={(v) => (params.promptGuidanceRescale = v)}
                />
            </div>

            <!-- Seed -->
            <div class="flex flex-col gap-1.5">
                <Label for="seed">시드 (0 = 랜덤)</Label>
                <Input
                    id="seed"
                    type="number"
                    value={params.seed}
                    oninput={(e) => (params.seed = Number((e.target as HTMLInputElement).value))}
                    min={0}
                />
            </div>

            <!-- Sampler -->
            <div class="flex flex-col gap-1.5">
                <Label>샘플러</Label>
                <Select.Root
                    type="single"
                    value={params.sampler}
                    onValueChange={(v) => (params.sampler = v)}
                >
                    <Select.Trigger class="w-full">
                        {SAMPLERS.find((s) => s.value === params.sampler)?.label ?? params.sampler}
                    </Select.Trigger>
                    <Select.Content>
                        {#each SAMPLERS as s}
                            <Select.Item value={s.value}>{s.label}</Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>

            <!-- Noise Schedule -->
            <div class="flex flex-col gap-1.5">
                <Label>노이즈 스케줄</Label>
                <Select.Root
                    type="single"
                    value={params.noiseSchedule}
                    onValueChange={(v) => (params.noiseSchedule = v)}
                >
                    <Select.Trigger class="w-full">
                        {NOISE_SCHEDULES.find((n) => n.value === params.noiseSchedule)?.label ??
                            params.noiseSchedule}
                    </Select.Trigger>
                    <Select.Content>
                        {#each NOISE_SCHEDULES as n}
                            <Select.Item value={n.value}>{n.label}</Select.Item>
                        {/each}
                    </Select.Content>
                </Select.Root>
            </div>

            <!-- Toggles -->
            <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between">
                    <Label>Quality Toggle</Label>
                    <Switch
                        checked={params.qualityToggle}
                        onCheckedChange={(v) => (params.qualityToggle = v)}
                    />
                </div>
                <div class="flex items-center justify-between">
                    <Label>Variety+</Label>
                    <Switch
                        checked={params.varietyPlus}
                        onCheckedChange={(v) => (params.varietyPlus = v)}
                    />
                </div>
                <div class="flex items-center justify-between">
                    <Label>캐릭터 위치 사용</Label>
                    <Switch
                        checked={params.useCharacterPositions}
                        onCheckedChange={(v) => (params.useCharacterPositions = v)}
                    />
                </div>
            </div>
        </div>

        <Sheet.Footer>
            <Button variant="outline" onclick={() => (open = false)}>취소</Button>
            <Button onclick={() => saveParams.mutate()} disabled={saveParams.isPending}>저장</Button>
        </Sheet.Footer>
    </Sheet.Content>
</Sheet.Root>
