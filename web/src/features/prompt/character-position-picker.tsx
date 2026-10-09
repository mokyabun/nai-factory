import { CHARACTER_GRID_STEPS, type CharacterPrompt, characterGridCell } from '@nai-factory/shared'
import { MapPin } from 'lucide-react'
import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type Center = CharacterPrompt['center']

const GRID_CELLS = CHARACTER_GRID_STEPS.flatMap((y) =>
    CHARACTER_GRID_STEPS.map((x) => ({ x, y, label: characterGridCell({ x, y }) })),
)

interface CharacterPositionPickerProps {
    center: Center
    /** Positions are on or off for all characters at once (`useCharacterPositions`). */
    enabled: boolean
    onCenterChange: (center: Center) => void
    onEnabledChange: (enabled: boolean) => void
    className?: string
}

export function CharacterPositionPicker({
    center,
    enabled,
    onCenterChange,
    onEnabledChange,
    className,
}: CharacterPositionPickerProps) {
    const current = characterGridCell(center)
    const switchId = useId()

    function pickCell(cell: Center) {
        onCenterChange(cell)
        if (!enabled) onEnabledChange(true)
    }

    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button
                        variant="outline"
                        size="xs"
                        className={cn(
                            'bg-background/90 font-mono tabular-nums',
                            !enabled && 'text-muted-foreground',
                            className,
                        )}
                        aria-label={enabled ? `캐릭터 위치 ${current}` : '캐릭터 위치 자동'}
                        title="캐릭터 위치"
                    />
                }
            >
                <MapPin />
                {enabled ? current : '자동'}
            </PopoverTrigger>
            <PopoverContent align="end" side="top" className="w-auto">
                <div className="flex items-center justify-between gap-4">
                    <Label htmlFor={switchId} className="text-xs">
                        캐릭터 위치 사용
                    </Label>
                    <Switch id={switchId} checked={enabled} onCheckedChange={onEnabledChange} />
                </div>
                <p className="text-muted-foreground">
                    {enabled ? '모든 캐릭터에 적용됩니다' : '꺼져 있으면 NovelAI가 위치를 정합니다'}
                </p>
                <div className="grid grid-cols-5 gap-1">
                    {GRID_CELLS.map((cell) => {
                        const selected = cell.label === current
                        return (
                            <button
                                key={cell.label}
                                type="button"
                                aria-pressed={enabled && selected}
                                className={cn(
                                    'flex size-9 items-center justify-center border font-mono text-[10px] transition-colors',
                                    selected && enabled
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : selected
                                          ? 'border-primary/50 text-foreground'
                                          : 'bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                )}
                                onClick={() => pickCell({ x: cell.x, y: cell.y })}
                            >
                                {cell.label}
                            </button>
                        )
                    })}
                </div>
            </PopoverContent>
        </Popover>
    )
}
