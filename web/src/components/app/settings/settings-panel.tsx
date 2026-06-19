import type { SettingsPatchBody } from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Provider, useAtom, useAtomValue } from 'jotai'
import { Bug, Eye, EyeOff, FolderInput, Plus, Save, Settings, Trash2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Switch } from '@/components/ui/switch'
import { api, type DebugRequestEntry } from '@/lib/api'
import { variableValidationMessage } from '@/lib/prompt-variables'
import { qk } from '@/lib/queries'
import { cn, debounce } from '@/lib/utils'
import {
    addGlobalVar,
    updateGlobalVar as applyGlobalVarUpdate,
    updateSettingsDraft as applySettingsDraftUpdate,
    createSettingsDraft,
    createSettingsPatch,
    debugRequestRowOpenAtom,
    type ImageFormat,
    removeGlobalVar,
    settingsDraftAtom,
    settingsPatchAtom,
    showApiKeyAtom,
} from './atom'

const IMAGE_FORMATS = [
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' },
    { value: 'avif', label: 'AVIF' },
]

function formatDuration(milliseconds: number | null) {
    if (milliseconds === null) return '-'
    if (milliseconds >= 1000) return `${(milliseconds / 1000).toFixed(1)}s`
    return `${milliseconds}ms`
}

function DebugRequestRow({ request }: { request: DebugRequestEntry }) {
    return (
        <Provider>
            <DebugRequestRowContent request={request} />
        </Provider>
    )
}

function DebugRequestRowContent({ request }: { request: DebugRequestEntry }) {
    const [open, setOpen] = useAtom(debugRequestRowOpenAtom)
    const statusVariant =
        request.status === 'success'
            ? 'secondary'
            : request.status === 'error'
              ? 'destructive'
              : 'outline'

    return (
        <div className="rounded border bg-background/40">
            <button
                type="button"
                className="flex w-full items-center gap-2 p-2 text-left"
                onClick={() => setOpen((v) => !v)}
            >
                <Badge variant={statusVariant} className="shrink-0">
                    {request.status}
                </Badge>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                    {request.method} {request.url.replace('https://image.novelai.net/ai/', '')}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDuration(request.durationMs)}
                </span>
            </button>
            {open && (
                <div className="border-t p-2">
                    <pre className="max-h-56 overflow-auto rounded bg-muted p-2 text-[10px] leading-relaxed">
                        {JSON.stringify(
                            {
                                context: request.context,
                                request: request.request,
                                response: request.response,
                                error: request.error,
                            },
                            null,
                            2,
                        )}
                    </pre>
                </div>
            )}
        </div>
    )
}

interface SettingsPanelProps {
    variant?: 'page' | 'sidebar'
}

export function SettingsPanel({ variant = 'page' }: SettingsPanelProps) {
    return (
        <Provider>
            <SettingsPanelContent variant={variant} />
        </Provider>
    )
}

function SettingsPanelContent({ variant = 'page' }: SettingsPanelProps) {
    const compact = variant === 'sidebar'
    const queryClient = useQueryClient()
    const [showApiKey, setShowApiKey] = useAtom(showApiKeyAtom)
    const [draft, setDraft] = useAtom(settingsDraftAtom)
    const settingsPatch = useAtomValue(settingsPatchAtom)
    const {
        apiKey,
        novelAIMode,
        globalVars,
        sourceFormat,
        sourceQuality,
        thumbFormat,
        thumbQuality,
        thumbSize,
        debugEnabled,
        debugRequestLimit,
        serverExportPath,
        loaded,
    } = draft

    const settingsQuery = useQuery({
        queryKey: qk.settings(),
        queryFn: async () => {
            const { data } = await api.settings.get()
            return data ?? null
        },
    })
    const lastSavedJson = useRef('')

    const debugRequestsQuery = useQuery({
        queryKey: qk.debugRequests(),
        queryFn: async () => {
            const { data } = await api.debug.requests.get()
            return data ?? []
        },
        enabled: debugEnabled,
    })

    useEffect(() => {
        const data = settingsQuery.data
        if (!data) return
        if (loaded) return

        const initialDraft = createSettingsDraft(data)
        setDraft(initialDraft)
        lastSavedJson.current = JSON.stringify(createSettingsPatch(initialDraft))
    }, [settingsQuery.data, loaded, setDraft])

    const saveSettings = useMutation({
        mutationFn: (patch: SettingsPatchBody) => api.settings.patch(patch),
        onSuccess: (res, patch) => {
            lastSavedJson.current = JSON.stringify(patch)
            if (res.data) queryClient.setQueryData(qk.settings(), res.data)
            queryClient.invalidateQueries({ queryKey: qk.novelAIStatus() })
        },
    })

    const debouncedSaveSettings = useRef(
        debounce((patch: SettingsPatchBody) => {
            if (patch.globalVariables && variableValidationMessage(patch.globalVariables)) return
            saveSettings.mutate(patch)
        }, 600),
    )

    useEffect(() => {
        if (!loaded) return

        const nextJson = JSON.stringify(settingsPatch)
        if (nextJson === lastSavedJson.current) return

        debouncedSaveSettings.current(settingsPatch)
    }, [loaded, settingsPatch])

    useEffect(() => {
        return () => debouncedSaveSettings.current.flush()
    }, [])

    const clearDebugRequests = useMutation({
        mutationFn: () => api.debug.requests.delete(),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.debugRequests() }),
    })

    function updateSettingsDraft(update: Partial<typeof draft>) {
        setDraft((current) => applySettingsDraftUpdate(current, update))
    }

    function updateGlobalVar(update: Parameters<typeof applyGlobalVarUpdate>[1]) {
        setDraft((current) => applyGlobalVarUpdate(current, update))
    }

    function appendGlobalVar() {
        setDraft((current) => addGlobalVar(current))
    }

    function deleteGlobalVar(index: number) {
        setDraft((current) => removeGlobalVar(current, index))
    }

    const saveButton = (
        <Button
            className="gap-1.5"
            disabled={saveSettings.isPending || !!variableValidationMessage(globalVars)}
            onClick={() => debouncedSaveSettings.current.flush()}
            size={compact ? 'sm' : 'default'}
        >
            <Save className="h-4 w-4" />
            {saveSettings.isPending ? '저장 중...' : '자동 저장'}
        </Button>
    )

    return (
        <div
            className={cn(
                'flex h-full min-h-0 flex-col',
                compact ? 'bg-sidebar' : 'mx-auto w-full max-w-2xl gap-6 p-6',
            )}
        >
            {compact ? (
                <SidebarHeader className="border-b">
                    <div className="flex min-w-0 items-center gap-2 px-1 py-1">
                        <Settings className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-md font-bold">설정</span>
                        {saveButton}
                    </div>
                </SidebarHeader>
            ) : (
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold">설정</h1>
                    {saveButton}
                </div>
            )}

            {settingsQuery.isPending ? (
                <div
                    className={cn(
                        'text-center text-sm text-muted-foreground',
                        compact && 'flex flex-1 items-center justify-center p-4 text-xs',
                    )}
                >
                    불러오는 중...
                </div>
            ) : (
                <div
                    className={cn(
                        'flex min-h-0 flex-1 flex-col overflow-y-auto',
                        compact ? 'gap-3 p-2 scrollbar-none' : 'gap-6',
                    )}
                >
                    <Card size={compact ? 'sm' : 'default'}>
                        <CardHeader>
                            <CardTitle className="text-base">NovelAI API Key</CardTitle>
                            <CardDescription>
                                이미지 생성에 사용할 NovelAI 계정의 API 키
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="relative">
                                <Input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={apiKey}
                                    onChange={(e) =>
                                        updateSettingsDraft({ apiKey: e.target.value })
                                    }
                                    placeholder="API 키 입력..."
                                    className="pr-10 font-mono text-sm"
                                />
                                <button
                                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowApiKey((v) => !v)}
                                    type="button"
                                >
                                    {showApiKey ? (
                                        <EyeOff className="h-4 w-4" />
                                    ) : (
                                        <Eye className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>테스트 모드</Label>
                                <Select
                                    value={novelAIMode}
                                    onValueChange={(value) =>
                                        updateSettingsDraft({
                                            novelAIMode: value as typeof novelAIMode,
                                        })
                                    }
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="live">Live</SelectItem>
                                        <SelectItem value="mock">Mock success</SelectItem>
                                        <SelectItem value="fail">Mock fail</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card size={compact ? 'sm' : 'default'}>
                        <CardHeader>
                            <CardTitle className="text-base">전역 변수</CardTitle>
                            <CardDescription>
                                모든 프로젝트 프롬프트에서 사용 가능한 변수
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-2">
                                {globalVars.map(({ key, value }, i) => (
                                    <div
                                        // biome-ignore lint/suspicious/noArrayIndexKey: draft settings rows can share empty keys until edited.
                                        key={i}
                                        className={cn(
                                            'flex gap-2',
                                            compact
                                                ? 'flex-col rounded border bg-background/40 p-2'
                                                : 'items-center',
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'flex gap-2',
                                                compact ? 'items-center' : 'flex-1 items-center',
                                            )}
                                        >
                                            <Input
                                                className="h-8 flex-1 font-mono text-xs"
                                                value={key}
                                                placeholder="변수명"
                                                onChange={(e) =>
                                                    updateGlobalVar({
                                                        index: i,
                                                        key: e.target.value,
                                                    })
                                                }
                                            />
                                            {!compact && (
                                                <span className="text-xs text-muted-foreground">
                                                    =
                                                </span>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0"
                                                onClick={() => deleteGlobalVar(i)}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        <Input
                                            className="h-8 flex-1 text-xs"
                                            value={value}
                                            placeholder="값"
                                            onChange={(e) =>
                                                updateGlobalVar({ index: i, value: e.target.value })
                                            }
                                        />
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 self-start"
                                    onClick={appendGlobalVar}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    변수 추가
                                </Button>
                                {variableValidationMessage(globalVars) && (
                                    <p className="text-[11px] text-destructive">
                                        {variableValidationMessage(globalVars)}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card size={compact ? 'sm' : 'default'}>
                        <CardHeader>
                            <CardTitle className="text-base">이미지 저장 설정</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div
                                className={cn(
                                    'grid gap-4',
                                    compact ? 'grid-cols-1' : 'grid-cols-2',
                                )}
                            >
                                <div className="flex flex-col gap-1.5">
                                    <Label>원본 형식</Label>
                                    <Select
                                        value={sourceFormat}
                                        onValueChange={(v) =>
                                            updateSettingsDraft({ sourceFormat: v as ImageFormat })
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {IMAGE_FORMATS.map((format) => (
                                                <SelectItem key={format.value} value={format.value}>
                                                    {format.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {sourceFormat !== 'png' && (
                                        <div className="flex items-center gap-2">
                                            <Label className="text-xs">품질</Label>
                                            <Input
                                                type="number"
                                                className="h-7 text-xs"
                                                value={sourceQuality}
                                                onChange={(e) =>
                                                    updateSettingsDraft({
                                                        sourceQuality: Number(e.target.value),
                                                    })
                                                }
                                                min={1}
                                                max={100}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label>썸네일 형식</Label>
                                    <Select
                                        value={thumbFormat}
                                        onValueChange={(v) =>
                                            updateSettingsDraft({ thumbFormat: v as ImageFormat })
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {IMAGE_FORMATS.map((format) => (
                                                <SelectItem key={format.value} value={format.value}>
                                                    {format.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {thumbFormat !== 'png' && (
                                        <div className="flex items-center gap-2">
                                            <Label className="text-xs">품질</Label>
                                            <Input
                                                type="number"
                                                className="h-7 text-xs"
                                                value={thumbQuality}
                                                onChange={(e) =>
                                                    updateSettingsDraft({
                                                        thumbQuality: Number(e.target.value),
                                                    })
                                                }
                                                min={1}
                                                max={100}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="thumb-size">썸네일 크기 (px)</Label>
                                <Input
                                    id="thumb-size"
                                    type="number"
                                    className="w-32"
                                    value={thumbSize}
                                    onChange={(e) =>
                                        updateSettingsDraft({ thumbSize: Number(e.target.value) })
                                    }
                                    min={64}
                                    max={1024}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card size={compact ? 'sm' : 'default'}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <FolderInput className="h-4 w-4" />
                                Export
                            </CardTitle>
                            <CardDescription>
                                서버 머신으로 복사할 때 사용할 대상 폴더
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="server-export-path">서버 export 경로</Label>
                                <Input
                                    id="server-export-path"
                                    value={serverExportPath}
                                    onChange={(e) =>
                                        updateSettingsDraft({ serverExportPath: e.target.value })
                                    }
                                    placeholder="/path/to/export"
                                    className="font-mono text-xs"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card size={compact ? 'sm' : 'default'}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Bug className="h-4 w-4" />
                                디버그
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex items-center justify-between gap-3">
                                <Label htmlFor="debug-mode">요청 기록</Label>
                                <Switch
                                    id="debug-mode"
                                    checked={debugEnabled}
                                    onCheckedChange={(debugEnabled) =>
                                        updateSettingsDraft({ debugEnabled })
                                    }
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Label htmlFor="debug-limit" className="shrink-0">
                                    최근
                                </Label>
                                <Input
                                    id="debug-limit"
                                    type="number"
                                    min={1}
                                    max={500}
                                    value={debugRequestLimit}
                                    onChange={(e) =>
                                        updateSettingsDraft({
                                            debugRequestLimit: Math.min(
                                                500,
                                                Math.max(1, Number(e.target.value) || 1),
                                            ),
                                        })
                                    }
                                    className="h-8 w-20 text-xs"
                                    disabled={!debugEnabled}
                                />
                                <span className="text-xs text-muted-foreground">개</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="ml-auto h-8 w-8"
                                    disabled={!debugEnabled || clearDebugRequests.isPending}
                                    onClick={() => clearDebugRequests.mutate()}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>

                            {debugEnabled && (
                                <div className="flex flex-col gap-2">
                                    {(debugRequestsQuery.data ?? []).length === 0 ? (
                                        <div className="rounded border bg-background/40 p-3 text-xs text-muted-foreground">
                                            기록 없음
                                        </div>
                                    ) : (
                                        (debugRequestsQuery.data ?? []).map((request) => (
                                            <DebugRequestRow key={request.id} request={request} />
                                        ))
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
