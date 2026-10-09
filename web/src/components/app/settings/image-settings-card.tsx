import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

import type { ImageFormat, SettingsDraft } from './atom'
import { SettingField } from './setting-field'

const IMAGE_FORMATS = [
    { value: 'png', label: 'PNG' },
    { value: 'webp', label: 'WebP' },
    { value: 'avif', label: 'AVIF' },
]

interface ImageSettingsCardProps {
    draft: SettingsDraft
    onChange: (update: Partial<SettingsDraft>) => void
}

export function ImageSettingsCard({ draft, onChange }: ImageSettingsCardProps) {
    const { sourceFormat, sourceQuality, thumbFormat, thumbQuality, thumbSize } = draft
    const updateSettingsDraft = onChange

    return (
        <Card className="shrink-0">
            <CardHeader>
                <CardTitle className="text-base">이미지 저장 설정</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <SettingField label="원본 형식">
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
                </SettingField>

                {sourceFormat !== 'png' && (
                    <SettingField label="원본 품질" htmlFor="source-quality">
                        <Input
                            id="source-quality"
                            type="number"
                            value={sourceQuality}
                            onChange={(e) =>
                                updateSettingsDraft({
                                    sourceQuality: Number(e.target.value),
                                })
                            }
                            min={1}
                            max={100}
                        />
                    </SettingField>
                )}

                <SettingField label="썸네일 형식">
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
                </SettingField>

                {thumbFormat !== 'png' && (
                    <SettingField label="썸네일 품질" htmlFor="thumb-quality">
                        <Input
                            id="thumb-quality"
                            type="number"
                            value={thumbQuality}
                            onChange={(e) =>
                                updateSettingsDraft({
                                    thumbQuality: Number(e.target.value),
                                })
                            }
                            min={1}
                            max={100}
                        />
                    </SettingField>
                )}

                <SettingField label="썸네일 크기 (px)" htmlFor="thumb-size">
                    <Input
                        id="thumb-size"
                        type="number"
                        value={thumbSize}
                        onChange={(e) => updateSettingsDraft({ thumbSize: Number(e.target.value) })}
                        min={64}
                        max={1024}
                    />
                </SettingField>
            </CardContent>
        </Card>
    )
}
