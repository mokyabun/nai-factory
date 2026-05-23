import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { qk } from '@/lib/queries'
import { VibeTransferEditor } from '../sidebar/sidebar-prompt/vibe-transfer-editor'

type ProjectParams = {
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

type ProjectData = {
    id: number
    parameters: ProjectParams
    characterPrompts: CharacterPrompt[] | null
}

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

interface ParametersPanelProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    project: ProjectData
}

type CharacterPrompt = {
    enabled: boolean
    center: { x: number; y: number }
    prompt: string
    uc: string
}

export function ParametersPanel({ open, onOpenChange, project }: ParametersPanelProps) {
    const queryClient = useQueryClient()
    const [params, setParams] = useState<ProjectParams>({ ...project.parameters })
    const [activeTab, setActiveTab] = useState('params')

    useEffect(() => {
        setParams({ ...project.parameters })
    }, [project.parameters])

    const saveParams = useMutation({
        mutationFn: () => api.projects({ projectId: project.id }).patch({ parameters: params }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.project(project.id) })
            onOpenChange(false)
        },
    })

    function set<K extends keyof ProjectParams>(key: K, value: ProjectParams[K]) {
        setParams((prev) => ({ ...prev, [key]: value }))
    }

    function sliderValue(value: number | readonly number[], fallback: number) {
        return typeof value === 'number' ? value : (value[0] ?? fallback)
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="flex w-[400px] flex-col overflow-hidden sm:max-w-none"
            >
                <SheetHeader className="shrink-0">
                    <SheetTitle>프로젝트 설정</SheetTitle>
                    <SheetDescription>
                        파라미터, 바이브 이미지, 캐릭터 레퍼런스를 관리합니다
                    </SheetDescription>
                </SheetHeader>

                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="flex min-h-0 flex-1 flex-col gap-0"
                >
                    <TabsList className="mx-4 w-[calc(100%-2rem)] shrink-0">
                        <TabsTrigger value="params">파라미터</TabsTrigger>
                        <TabsTrigger value="vibe">바이브 이미지</TabsTrigger>
                        <TabsTrigger value="character">캐릭터 레퍼런스</TabsTrigger>
                    </TabsList>

                    <div className="min-h-0 flex-1 overflow-y-auto px-4">
                        <TabsContent value="params" className="mt-0 flex flex-col gap-5 py-4">
                            {/* Model */}
                            <div className="flex flex-col gap-1.5">
                                <Label>모델</Label>
                                <Select
                                    value={params.model}
                                    onValueChange={(v) => v && set('model', v)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MODELS.map((m) => (
                                            <SelectItem key={m.value} value={m.value}>
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Size */}
                            <div className="flex gap-3">
                                <div className="flex flex-1 flex-col gap-1.5">
                                    <Label htmlFor="width">너비</Label>
                                    <Input
                                        id="width"
                                        type="number"
                                        value={params.width}
                                        onChange={(e) => set('width', Number(e.target.value))}
                                        min={64}
                                        max={2048}
                                        step={64}
                                    />
                                </div>
                                <div className="flex flex-1 flex-col gap-1.5">
                                    <Label htmlFor="height">높이</Label>
                                    <Input
                                        id="height"
                                        type="number"
                                        value={params.height}
                                        onChange={(e) => set('height', Number(e.target.value))}
                                        min={64}
                                        max={2048}
                                        step={64}
                                    />
                                </div>
                            </div>

                            {/* Steps */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <Label>스텝</Label>
                                    <span className="text-sm text-muted-foreground">
                                        {params.steps}
                                    </span>
                                </div>
                                <Slider
                                    value={[params.steps]}
                                    min={1}
                                    max={50}
                                    step={1}
                                    onValueChange={(value) =>
                                        set('steps', sliderValue(value, params.steps))
                                    }
                                />
                            </div>

                            {/* CFG Scale */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <Label>CFG Scale</Label>
                                    <span className="text-sm text-muted-foreground">
                                        {params.promptGuidance}
                                    </span>
                                </div>
                                <Slider
                                    value={[params.promptGuidance]}
                                    min={1}
                                    max={10}
                                    step={0.1}
                                    onValueChange={(value) =>
                                        set(
                                            'promptGuidance',
                                            sliderValue(value, params.promptGuidance),
                                        )
                                    }
                                />
                            </div>

                            {/* CFG Rescale */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <Label>CFG Rescale</Label>
                                    <span className="text-sm text-muted-foreground">
                                        {params.promptGuidanceRescale}
                                    </span>
                                </div>
                                <Slider
                                    value={[params.promptGuidanceRescale]}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    onValueChange={(value) =>
                                        set(
                                            'promptGuidanceRescale',
                                            sliderValue(value, params.promptGuidanceRescale),
                                        )
                                    }
                                />
                            </div>

                            {/* Seed */}
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="seed">시드 (0 = 랜덤)</Label>
                                <Input
                                    id="seed"
                                    type="number"
                                    value={params.seed}
                                    onChange={(e) => set('seed', Number(e.target.value))}
                                    min={0}
                                />
                            </div>

                            {/* Sampler */}
                            <div className="flex flex-col gap-1.5">
                                <Label>샘플러</Label>
                                <Select
                                    value={params.sampler}
                                    onValueChange={(v) => v && set('sampler', v)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SAMPLERS.map((s) => (
                                            <SelectItem key={s.value} value={s.value}>
                                                {s.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Noise Schedule */}
                            <div className="flex flex-col gap-1.5">
                                <Label>노이즈 스케줄</Label>
                                <Select
                                    value={params.noiseSchedule}
                                    onValueChange={(v) => v && set('noiseSchedule', v)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {NOISE_SCHEDULES.map((n) => (
                                            <SelectItem key={n.value} value={n.value}>
                                                {n.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Toggles */}
                            <div className="flex flex-col gap-3">
                                {(
                                    [
                                        ['qualityToggle', 'Quality Toggle'],
                                        ['varietyPlus', 'Variety+'],
                                        ['useCharacterPositions', '캐릭터 위치 사용'],
                                    ] as const
                                ).map(([key, label]) => (
                                    <div key={key} className="flex items-center justify-between">
                                        <Label>{label}</Label>
                                        <Switch
                                            checked={params[key] as boolean}
                                            onCheckedChange={(v) => set(key, v)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="vibe" className="mt-0 py-4">
                            <VibeTransferEditor projectId={project.id} />
                        </TabsContent>

                        <TabsContent value="character" className="mt-0 py-4">
                            {/* CharacterPromptEditor goes here */}
                            Not implemented yet
                        </TabsContent>
                    </div>
                </Tabs>

                <SheetFooter className="shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        닫기
                    </Button>
                    {activeTab === 'params' && (
                        <Button onClick={() => saveParams.mutate()} disabled={saveParams.isPending}>
                            저장
                        </Button>
                    )}
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
