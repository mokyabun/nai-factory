import type { EnqueuePosition, Parameters, PlaygroundSettings } from '@nai-factory/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine, ArrowUpToLine, FlaskConical, Loader } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import { SidebarHeader } from '@/components/ui/sidebar'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { qk } from '@/lib/queries'
import { debounce } from '@/lib/utils'

const DEFAULT_PARAMETERS: Parameters = {
    model: 'nai-diffusion-4-5-full',
    qualityToggle: false,
    width: 1024,
    height: 1024,
    steps: 28,
    promptGuidance: 6,
    varietyPlus: false,
    seed: 0,
    sampler: 'k_euler_ancestral',
    promptGuidanceRescale: 0.7,
    noiseSchedule: 'karras',
    normalizeReferenceStrengthValues: false,
    useCharacterPositions: false,
}

const DEFAULT_SETTINGS: PlaygroundSettings = {
    id: 1,
    prompt: '',
    negativePrompt: '',
    parameters: DEFAULT_PARAMETERS,
    updatedAt: '',
}

const MODELS = [
    { value: 'nai-diffusion-4-5-full', label: 'NAI Diffusion 4.5 Full' },
    { value: 'nai-diffusion-4-5-curated', label: 'NAI Diffusion 4.5 Curated' },
    { value: 'nai-diffusion-4-full', label: 'NAI Diffusion 4 Full' },
    { value: 'nai-diffusion-4-curated', label: 'NAI Diffusion 4 Curated' },
] as const

const SAMPLERS = [
    { value: 'k_euler_ancestral', label: 'Euler Ancestral' },
    { value: 'k_euler', label: 'Euler' },
    { value: 'k_dpmpp_2s_ancestral', label: 'DPM++ 2S Ancestral' },
    { value: 'k_dpmpp_2m', label: 'DPM++ 2M' },
    { value: 'k_dpmpp_sde', label: 'DPM++ SDE' },
    { value: 'k_dpmpp_2m_sde', label: 'DPM++ 2M SDE' },
    { value: 'dimm_v3', label: 'DIMM v3' },
] as const

const NOISE_SCHEDULES = [
    { value: 'native', label: 'Native' },
    { value: 'karras', label: 'Karras' },
    { value: 'exponential', label: 'Exponential' },
    { value: 'polyexponential', label: 'Polyexponential' },
] as const

export function SidebarPlayground() {
    const queryClient = useQueryClient()
    const [settings, setSettings] = useState<PlaygroundSettings>(DEFAULT_SETTINGS)
    const latestSettingsRef = useRef<PlaygroundSettings>(DEFAULT_SETTINGS)
    const dirtyRef = useRef(false)

    const settingsQuery = useQuery({
        queryKey: qk.playgroundSettings(),
        queryFn: async () => {
            const { data } = await api.playground.settings.get()
            return data ?? DEFAULT_SETTINGS
        },
    })

    const saveSettingsRef = useRef(
        debounce(async (nextSettings: PlaygroundSettings) => {
            const { data } = await api.playground.settings.patch({
                prompt: nextSettings.prompt,
                negativePrompt: nextSettings.negativePrompt,
                parameters: nextSettings.parameters,
            })

            if (
                JSON.stringify(latestSettingsRef.current) !== JSON.stringify(nextSettings) ||
                !data
            ) {
                return
            }

            dirtyRef.current = false
            queryClient.setQueryData(qk.playgroundSettings(), data)
        }, 600),
    )

    useEffect(() => {
        if (!dirtyRef.current && settingsQuery.data) {
            latestSettingsRef.current = settingsQuery.data
            setSettings(settingsQuery.data)
        }
    }, [settingsQuery.data])

    useEffect(() => {
        return () => saveSettingsRef.current.flush()
    }, [])

    const enqueue = useMutation({
        mutationFn: (position: EnqueuePosition) =>
            api.playground.enqueue.post({
                prompt: settings.prompt,
                negativePrompt: settings.negativePrompt,
                parameters: settings.parameters,
                position,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: qk.queueStatus() })
            queryClient.invalidateQueries({ queryKey: qk.queue(null) })
        },
    })

    function updateSettings(updater: (prev: PlaygroundSettings) => PlaygroundSettings) {
        setSettings((prev) => {
            const nextSettings = updater(prev)
            latestSettingsRef.current = nextSettings
            dirtyRef.current = true
            saveSettingsRef.current(nextSettings)
            return nextSettings
        })
    }

    function setField<K extends keyof PlaygroundSettings>(key: K, value: PlaygroundSettings[K]) {
        updateSettings((prev) => ({ ...prev, [key]: value }))
    }

    function setParameter<K extends keyof Parameters>(key: K, value: Parameters[K]) {
        updateSettings((prev) => ({
            ...prev,
            parameters: { ...prev.parameters, [key]: value },
        }))
    }

    function sliderValue(value: number | readonly number[], fallback: number) {
        return typeof value === 'number' ? value : (value[0] ?? fallback)
    }

    const isEnqueueDisabled = !settings.prompt.trim() || enqueue.isPending

    return (
        <div className="flex h-full min-h-0 flex-col bg-sidebar">
            <SidebarHeader className="border-b">
                <div className="flex min-w-0 items-center gap-2 px-1 py-1">
                    <FlaskConical className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-md font-bold">Playground</span>
                </div>
                <div className="grid grid-cols-2 gap-2 px-1 pb-1">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5"
                        onClick={() => enqueue.mutate('front')}
                        disabled={isEnqueueDisabled}
                    >
                        {enqueue.isPending ? (
                            <Loader className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <ArrowUpToLine className="h-3.5 w-3.5" />
                        )}
                        앞에 추가
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => enqueue.mutate('back')}
                        disabled={isEnqueueDisabled}
                    >
                        {enqueue.isPending ? (
                            <Loader className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <ArrowDownToLine className="h-3.5 w-3.5" />
                        )}
                        뒤에 추가
                    </Button>
                </div>
            </SidebarHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3 scrollbar-none">
                <div className="flex flex-col gap-2">
                    <Label htmlFor="sidebar-playground-prompt">Prompt</Label>
                    <Textarea
                        id="sidebar-playground-prompt"
                        value={settings.prompt}
                        onChange={(event) => setField('prompt', event.target.value)}
                        className="min-h-36 resize-y"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <Label htmlFor="sidebar-playground-negative-prompt">Negative Prompt</Label>
                    <Textarea
                        id="sidebar-playground-negative-prompt"
                        value={settings.negativePrompt}
                        onChange={(event) => setField('negativePrompt', event.target.value)}
                        className="min-h-24 resize-y"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label>모델</Label>
                    <Select
                        value={settings.parameters.model}
                        onValueChange={(value) =>
                            setParameter('model', value as Parameters['model'])
                        }
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MODELS.map((model) => (
                                <SelectItem key={model.value} value={model.value}>
                                    {model.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <NumberField
                        id="sidebar-playground-width"
                        label="너비"
                        value={settings.parameters.width}
                        min={64}
                        max={2048}
                        step={64}
                        onChange={(value) => setParameter('width', value)}
                    />
                    <NumberField
                        id="sidebar-playground-height"
                        label="높이"
                        value={settings.parameters.height}
                        min={64}
                        max={2048}
                        step={64}
                        onChange={(value) => setParameter('height', value)}
                    />
                </div>

                <ParameterSlider
                    label="스텝"
                    value={settings.parameters.steps}
                    min={1}
                    max={50}
                    step={1}
                    onChange={(value) =>
                        setParameter('steps', sliderValue(value, settings.parameters.steps))
                    }
                />
                <ParameterSlider
                    label="CFG Scale"
                    value={settings.parameters.promptGuidance}
                    min={1}
                    max={10}
                    step={0.1}
                    onChange={(value) =>
                        setParameter(
                            'promptGuidance',
                            sliderValue(value, settings.parameters.promptGuidance),
                        )
                    }
                />
                <ParameterSlider
                    label="CFG Rescale"
                    value={settings.parameters.promptGuidanceRescale}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(value) =>
                        setParameter(
                            'promptGuidanceRescale',
                            sliderValue(value, settings.parameters.promptGuidanceRescale),
                        )
                    }
                />

                <NumberField
                    id="sidebar-playground-seed"
                    label="시드 (0 = 랜덤)"
                    value={settings.parameters.seed}
                    min={0}
                    onChange={(value) => setParameter('seed', value)}
                />

                <div className="flex flex-col gap-1.5">
                    <Label>샘플러</Label>
                    <Select
                        value={settings.parameters.sampler}
                        onValueChange={(value) =>
                            setParameter('sampler', value as Parameters['sampler'])
                        }
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SAMPLERS.map((sampler) => (
                                <SelectItem key={sampler.value} value={sampler.value}>
                                    {sampler.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label>노이즈 스케줄</Label>
                    <Select
                        value={settings.parameters.noiseSchedule}
                        onValueChange={(value) =>
                            setParameter('noiseSchedule', value as Parameters['noiseSchedule'])
                        }
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {NOISE_SCHEDULES.map((schedule) => (
                                <SelectItem key={schedule.value} value={schedule.value}>
                                    {schedule.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-3 pb-4">
                    <ToggleRow
                        label="Quality Toggle"
                        checked={settings.parameters.qualityToggle}
                        onChange={(checked) => setParameter('qualityToggle', checked)}
                    />
                    <ToggleRow
                        label="Variety+"
                        checked={settings.parameters.varietyPlus}
                        onChange={(checked) => setParameter('varietyPlus', checked)}
                    />
                </div>
            </div>
        </div>
    )
}

function NumberField({
    id,
    label,
    value,
    min,
    max,
    step,
    onChange,
}: {
    id: string
    label: string
    value: number
    min?: number
    max?: number
    step?: number
    onChange: (value: number) => void
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </div>
    )
}

function ParameterSlider({
    label,
    value,
    min,
    max,
    step,
    onChange,
}: {
    label: string
    value: number
    min: number
    max: number
    step: number
    onChange: (value: number | readonly number[]) => void
}) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <span className="text-xs text-muted-foreground">{value}</span>
            </div>
            <Slider value={[value]} min={min} max={max} step={step} onValueChange={onChange} />
        </div>
    )
}

function ToggleRow({
    label,
    checked,
    onChange,
}: {
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <Label>{label}</Label>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    )
}
