import type { Parameters, PlaygroundState } from '@nai-factory/shared'

import { ParametersForm } from '@/features/prompt/parameters-form'
import { PromptEditor } from '@/features/prompt/prompt-editor'

interface PlaygroundEditorProps {
    settings: PlaygroundState
    onFieldChange: (key: 'prompt' | 'negativePrompt', value: string) => void
    onParameterChange: <K extends keyof Parameters>(key: K, value: Parameters[K]) => void
}

export function PlaygroundEditor({
    settings,
    onFieldChange,
    onParameterChange,
}: PlaygroundEditorProps) {
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-3 scrollbar-none">
            <PromptEditor
                prompt={settings.prompt}
                negativePrompt={settings.negativePrompt}
                onPromptChange={(value) => onFieldChange('prompt', value)}
                onNegativePromptChange={(value) => onFieldChange('negativePrompt', value)}
                className="min-h-[300px] shrink-0"
            />

            <ParametersForm
                scope="playground"
                parameters={settings.parameters}
                onChange={onParameterChange}
            />
        </div>
    )
}
