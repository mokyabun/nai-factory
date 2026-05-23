import type { PromptVariation } from '@nai-factory/types'
import { Plus, Trash2, X } from 'lucide-react'
import { CodeEditor } from '@/components/app/code-editor/code-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface VariationEditorProps {
    variations: PromptVariation[]
    onChange: (variations: PromptVariation[]) => void
    layout?: 'col' | 'row'
}

export function VariationEditor({ variations, onChange, layout = 'col' }: VariationEditorProps) {
    function addVariation() {
        onChange([...variations, {}])
    }

    function removeVariation(i: number) {
        onChange(variations.filter((_, idx) => idx !== i))
    }

    function addKey(varIdx: number) {
        const updated = [...variations]
        updated[varIdx] = { ...updated[varIdx], '': '' }
        onChange(updated)
    }

    function removeKey(varIdx: number, key: string) {
        const updated = [...variations]
        const { [key]: _, ...rest } = updated[varIdx]
        updated[varIdx] = rest
        onChange(updated)
    }

    function updateKey(varIdx: number, oldKey: string, newKey: string) {
        const updated = [...variations]
        const obj = { ...updated[varIdx] }
        const value = obj[oldKey] ?? ''
        delete obj[oldKey]
        obj[newKey] = value
        updated[varIdx] = obj
        onChange(updated)
    }

    function updateValue(varIdx: number, key: string, value: string) {
        const updated = [...variations]
        updated[varIdx] = { ...updated[varIdx], [key]: value }
        onChange(updated)
    }

    return (
        <div className="flex flex-col gap-3">
            <div className={layout === 'row' ? 'flex flex-nowrap gap-4' : 'flex flex-col gap-3'}>
                {variations.map((variation, varIdx) => (
                    <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: variations have no persisted id and position is their editor identity.
                        key={varIdx}
                        className={`rounded-md border bg-card p-3 ${layout === 'row' ? 'w-96 shrink-0' : ''}`}
                    >
                        <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                                변수 세트 {varIdx + 1}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => removeVariation(varIdx)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        <div className="flex flex-col gap-2">
                            {Object.entries(variation).map(([key, value]) => (
                                <div key={key} className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5">
                                        <Input
                                            className="h-7 flex-1 px-2 font-mono text-xs"
                                            defaultValue={key}
                                            placeholder="변수명"
                                            onBlur={(e) => updateKey(varIdx, key, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter')
                                                    updateKey(varIdx, key, e.currentTarget.value)
                                            }}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0 text-muted-foreground"
                                            onClick={() => removeKey(varIdx, key)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <CodeEditor
                                        value={value}
                                        placeholder="값 (태그, 프롬프트 등)..."
                                        minLines={layout === 'row' ? 4 : 2}
                                        onChange={(v) => updateValue(varIdx, key, v)}
                                    />
                                </div>
                            ))}
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-6 w-full gap-1 text-xs text-muted-foreground"
                            onClick={() => addKey(varIdx)}
                        >
                            <Plus className="h-3 w-3" />
                            변수 추가
                        </Button>
                    </div>
                ))}
            </div>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={addVariation}>
                <Plus className="h-3.5 w-3.5" />
                변수 세트 추가
            </Button>
        </div>
    )
}
