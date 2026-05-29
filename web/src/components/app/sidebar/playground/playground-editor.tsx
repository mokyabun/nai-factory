import type { Parameters, PlaygroundSettings } from '@nai-factory/shared'
import { PromptEditor } from '../prompt-editor'
import { PlaygroundParameters } from './playground-parameters'

interface PlaygroundEditorProps {
    settings: PlaygroundSettings
    onFieldChange: <K extends keyof PlaygroundSettings>(
        key: K,
        value: PlaygroundSettings[K],
    ) => void
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

            <PlaygroundParameters parameters={settings.parameters} onChange={onParameterChange} />
        </div>
    )
}
