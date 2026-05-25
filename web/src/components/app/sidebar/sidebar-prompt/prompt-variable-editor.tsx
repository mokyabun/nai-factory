import { Plus, X } from 'lucide-react'
import { CodeEditor } from '@/components/app/code-editor/code-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { tagCompletionSource } from '@/lib/tag-autocomplete'

type PromptVariableEditorProps = {
    variables: [string, string][]
    onChange: (vars: [string, string][]) => void
}

export function PromptVariableEditor({ variables, onChange }: PromptVariableEditorProps) {
    function addVariable() {
        onChange([...variables, ['', '']])
    }

    function removeVariable(i: number) {
        onChange(variables.filter((_, idx) => idx !== i))
    }

    function updateVarKey(i: number, key: string) {
        const next = variables.map((v, idx) => (idx === i ? [key, v[1]] : v)) as [string, string][]
        onChange(next)
    }

    function updateVarValue(i: number, value: string) {
        const next = variables.map((v, idx) => (idx === i ? [v[0], value] : v)) as [
            string,
            string,
        ][]
        onChange(next)
    }

    return (
        <div className="flex flex-col gap-2">
            {variables.map(([key, value], i) => (
                <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: draft variable rows can share empty keys until edited.
                    key={i}
                    className="flex flex-col gap-1"
                >
                    <div className="flex items-center gap-1">
                        <Input
                            className="h-7 flex-1 px-2 font-mono text-xs"
                            value={key}
                            placeholder="변수명"
                            onChange={(e) => updateVarKey(i, e.target.value)}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => removeVariable(i)}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                    <CodeEditor
                        value={value}
                        placeholder="값 (태그, 프롬프트 등)..."
                        minLines={2}
                        completionSource={tagCompletionSource}
                        onChange={(v) => updateVarValue(i, v)}
                    />
                </div>
            ))}
            <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={addVariable}
            >
                <Plus className="h-3.5 w-3.5" />
                변수 추가
            </Button>
        </div>
    )
}
