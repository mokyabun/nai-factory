import type { SettingsPatch, SettingsView } from '@nai-factory/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Provider, useAtom, useAtomValue } from 'jotai'
import { Bug, FolderInput, Plus, Save, Settings, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

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
import { Switch } from '@/components/ui/switch'
import { useDebouncedPatch } from '@/hooks/use-debounced-patch'
import { call, contract, errorMessage } from '@/lib/api'
import { variableValidationMessage } from '@/lib/prompt-variables'
import { qk } from '@/lib/queries'

import {
    addGlobalVar,
    updateGlobalVar as applyGlobalVarUpdate,
    updateSettingsDraft as applySettingsDraftUpdate,
    changedSettings,
    createSettingsDraft,
    createSettingsPatch,
    type FullSettingsPatch,
    removeGlobalVar,
    settingsDraftAtom,
    settingsPatchAtom,
} from './atom'
import { ImageSettingsCard } from './image-settings-card'
import { NovelAIKeyCard } from './novelai-key-card'
import { SettingField } from './setting-field'

export function SettingsPanel() {
    return (
        <Provider>
            <SettingsPanelContent />
        </Provider>
    )
}

function SettingsPanelContent() {
    const queryClient = useQueryClient()
    const [draft, setDraft] = useAtom(settingsDraftAtom)
    const settingsPatch = useAtomValue(settingsPatchAtom)
    const { novelAIMode, globalVars, debugEnabled, debugRequestLimit, loaded } = draft

    const settingsQuery = useQuery({
        queryKey: qk.settings.get(),
        queryFn: () => call(contract.settings.get),
    })
    const lastSaved = useRef<FullSettingsPatch | null>(null)

    useEffect(() => {
        const data = settingsQuery.data
        if (!data) return
        if (loaded) return

        const initialDraft = createSettingsDraft(data)
        setDraft(initialDraft)
        lastSaved.current = createSettingsPatch(initialDraft)
    }, [settingsQuery.data, loaded, setDraft])

    const saveSettings = useMutation({
        mutationFn: (patch: SettingsPatch) => call(contract.settings.update, { body: patch }),
        onSuccess: (data: SettingsView) => queryClient.setQueryData(qk.settings.get(), data),
        // Resend every section with the next change after a failed save.
        onError: () => {
            lastSaved.current = null
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: qk.settings.get() }),
    })

    const pendingSave = useDebouncedPatch<SettingsPatch>((patch) => {
        if (patch.globalVariables && variableValidationMessage(patch.globalVariables)) return
        saveSettings.mutate(patch)
    })

    useEffect(() => {
        if (!loaded) return
        // Send only the sections that changed since the last save.
        const patch = changedSettings(lastSaved.current, settingsPatch)
        if (Object.keys(patch).length === 0) return
        lastSaved.current = settingsPatch
        pendingSave.schedule(patch)
    }, [loaded, settingsPatch, pendingSave])

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

    return (
        <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-4 p-2">
            <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-2">
                    <Settings className="h-4 w-4 shrink-0" />
                    <h1 className="truncate text-xl font-bold">설정</h1>
                </div>
                <Button
                    className="gap-1.5"
                    disabled={saveSettings.isPending || !!variableValidationMessage(globalVars)}
                    onClick={() => pendingSave.flush()}
                >
                    <Save className="h-4 w-4" />
                    {saveSettings.isPending ? '저장 중...' : '자동 저장'}
                </Button>
            </div>

            {saveSettings.error && (
                <p className="px-2 text-xs text-destructive">{errorMessage(saveSettings.error)}</p>
            )}
            {settingsQuery.isPending ? (
                <div className="text-center text-sm text-muted-foreground">불러오는 중...</div>
            ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
                    <NovelAIKeyCard settings={settingsQuery.data} />

                    <Card className="shrink-0">
                        <CardHeader>
                            <CardTitle className="text-base">NovelAI 모드</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <SettingField label="테스트 모드">
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
                            </SettingField>
                        </CardContent>
                    </Card>

                    <Card className="shrink-0">
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
                                        // draft settings rows can share empty keys until edited.
                                        key={i}
                                        className="flex items-center gap-2"
                                    >
                                        <div className="flex flex-1 items-center gap-2">
                                            <Input
                                                className="flex-1 font-mono"
                                                value={key}
                                                placeholder="변수명"
                                                onChange={(e) =>
                                                    updateGlobalVar({
                                                        index: i,
                                                        key: e.target.value,
                                                    })
                                                }
                                            />
                                            <span className="text-xs text-muted-foreground">
                                                =
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="shrink-0"
                                                onClick={() => deleteGlobalVar(i)}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        <Input
                                            className="flex-1"
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

                    <ImageSettingsCard
                       
                        draft={draft}
                        onChange={updateSettingsDraft}
                    />

                    <Card className="shrink-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <FolderInput className="h-4 w-4" />
                                Export
                            </CardTitle>
                            <CardDescription>
                                서버 머신의 폴더로 이미지를 복사합니다
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">
                                {settingsQuery.data?.export.serverExportEnabled
                                    ? '서버 export가 켜져 있습니다. 내보내기 창에서 폴더 이름을 입력하면 서버의 export 폴더 아래에 저장됩니다.'
                                    : '서버 export는 서버의 NAI_FACTORY_EXPORT_DIR 환경 변수를 설정해야 사용할 수 있습니다.'}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="shrink-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Bug className="h-4 w-4" />
                                디버그
                            </CardTitle>
                            <CardDescription>
                                실패한 NovelAI 요청은 Log 페이지에 항상 저장됩니다.
                            </CardDescription>
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

                            <SettingField label="최근 요청 기록 개수" htmlFor="debug-limit">
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
                                    disabled={!debugEnabled}
                                />
                            </SettingField>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
