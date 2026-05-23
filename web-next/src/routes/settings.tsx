import type { ImageSaveType } from '@nai-factory/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Eye, EyeOff, Plus, Save, X } from 'lucide-react'
import { useEffect, useState } from 'react'
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
import { api } from '@/lib/api'
import { qk } from '@/lib/queries'

export const Route = createFileRoute('/settings')({ component: SettingsPage })

const IMAGE_FORMATS = [
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' },
    { value: 'avif', label: 'AVIF' },
]

function SettingsPage() {
    const queryClient = useQueryClient()

    const settingsQuery = useQuery({
        queryKey: qk.settings(),
        queryFn: async () => {
            const { data } = await api.settings.get()
            return data ?? null
        },
    })

    const [showApiKey, setShowApiKey] = useState(false)
    const [apiKey, setApiKey] = useState('')
    const [globalVars, setGlobalVars] = useState<[string, string][]>([])
    const [sourceFormat, setSourceFormat] = useState<'png' | 'webp' | 'avif'>('png')
    const [sourceQuality, setSourceQuality] = useState(90)
    const [thumbFormat, setThumbFormat] = useState<'png' | 'webp' | 'avif'>('webp')
    const [thumbQuality, setThumbQuality] = useState(80)
    const [thumbSize, setThumbSize] = useState(256)
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
        const data = settingsQuery.data
        if (data && !loaded) {
            setLoaded(true)
            setApiKey(data.novelai?.apiKey ?? '')
            setGlobalVars(Object.entries(data.globalVariables ?? {}))
            setSourceFormat(data.image?.sourceType?.type ?? 'png')
            setSourceQuality(
                data.image?.sourceType?.type === 'png'
                    ? 90
                    : (data.image?.sourceType?.quality ?? 90),
            )
            setThumbFormat(data.image?.thumbnailType?.type ?? 'webp')
            setThumbQuality(
                data.image?.thumbnailType?.type === 'png'
                    ? 80
                    : (data.image?.thumbnailType?.quality ?? 80),
            )
            setThumbSize(data.image?.thumbnailSize ?? 256)
        }
    }, [settingsQuery.data, loaded])

    const saveSettings = useMutation({
        mutationFn: () => {
            const sourceType: ImageSaveType =
                sourceFormat === 'png'
                    ? { type: 'png' }
                    : { type: sourceFormat, quality: sourceQuality }
            const thumbnailType: ImageSaveType =
                thumbFormat === 'png'
                    ? { type: 'png' }
                    : { type: thumbFormat, quality: thumbQuality }

            return api.settings.patch({
                novelai: { apiKey },
                globalVariables: Object.fromEntries(globalVars),
                image: { sourceType, thumbnailType, thumbnailSize: thumbSize },
            })
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.settings() }),
    })

    return (
        <div className="mx-auto flex h-full max-w-2xl flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">설정</h1>
                <Button
                    className="gap-1.5"
                    disabled={saveSettings.isPending}
                    onClick={() => saveSettings.mutate()}
                >
                    <Save className="h-4 w-4" />
                    {saveSettings.isPending ? '저장 중...' : '저장'}
                </Button>
            </div>

            {settingsQuery.isPending ? (
                <div className="text-center text-sm text-muted-foreground">불러오는 중...</div>
            ) : (
                <>
                    {/* NovelAI API Key */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">NovelAI API Key</CardTitle>
                            <CardDescription>
                                이미지 생성에 사용할 NovelAI 계정의 API 키
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="relative">
                                <Input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
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
                        </CardContent>
                    </Card>

                    {/* Global Variables */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">전역 변수</CardTitle>
                            <CardDescription>
                                모든 프로젝트 프롬프트에서 사용 가능한 변수
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-2">
                                {globalVars.map(([key, value], i) => (
                                    <div
                                        // biome-ignore lint/suspicious/noArrayIndexKey: draft settings rows can share empty keys until edited.
                                        key={i}
                                        className="flex items-center gap-2"
                                    >
                                        <Input
                                            className="h-8 flex-1 font-mono text-xs"
                                            value={key}
                                            placeholder="변수명"
                                            onChange={(e) =>
                                                setGlobalVars((prev) =>
                                                    prev.map((v, idx) =>
                                                        idx === i ? [e.target.value, v[1]] : v,
                                                    ),
                                                )
                                            }
                                        />
                                        <span className="text-xs text-muted-foreground">=</span>
                                        <Input
                                            className="h-8 flex-1 text-xs"
                                            value={value}
                                            placeholder="값"
                                            onChange={(e) =>
                                                setGlobalVars((prev) =>
                                                    prev.map((v, idx) =>
                                                        idx === i ? [v[0], e.target.value] : v,
                                                    ),
                                                )
                                            }
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            onClick={() =>
                                                setGlobalVars((prev) =>
                                                    prev.filter((_, idx) => idx !== i),
                                                )
                                            }
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 self-start"
                                    onClick={() => setGlobalVars((prev) => [...prev, ['', '']])}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    변수 추가
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Image Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">이미지 저장 설정</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                {/* Source format */}
                                <div className="flex flex-col gap-1.5">
                                    <Label>원본 형식</Label>
                                    <Select
                                        value={sourceFormat}
                                        onValueChange={(v) =>
                                            setSourceFormat(v as 'png' | 'webp' | 'avif')
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {IMAGE_FORMATS.map((f) => (
                                                <SelectItem key={f.value} value={f.value}>
                                                    {f.label}
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
                                                    setSourceQuality(Number(e.target.value))
                                                }
                                                min={1}
                                                max={100}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Thumbnail format */}
                                <div className="flex flex-col gap-1.5">
                                    <Label>썸네일 형식</Label>
                                    <Select
                                        value={thumbFormat}
                                        onValueChange={(v) =>
                                            setThumbFormat(v as 'png' | 'webp' | 'avif')
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {IMAGE_FORMATS.map((f) => (
                                                <SelectItem key={f.value} value={f.value}>
                                                    {f.label}
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
                                                    setThumbQuality(Number(e.target.value))
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
                                    onChange={(e) => setThumbSize(Number(e.target.value))}
                                    min={64}
                                    max={1024}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
