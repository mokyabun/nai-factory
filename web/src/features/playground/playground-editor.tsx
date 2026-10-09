import type { CharacterPrompt, Parameters, PlaygroundState } from '@nai-factory/shared'

import { CharacterPromptEditor } from '@/features/prompt/character-prompt-editor'
import { ParametersForm } from '@/features/prompt/parameters-form'
import { PromptEditor } from '@/features/prompt/prompt-editor'

interface PlaygroundEditorProps {
    settings: PlaygroundState
    onFieldChange: (key: 'prompt' | 'negativePrompt', value: string) => void
    onCharacterPromptsChange: (
        characterPrompts: CharacterPrompt[],
        options?: { immediate?: boolean },
    ) => void
    onParameterChange: <K extends keyof Parameters>(key: K, value: Parameters[K]) => void
}

export function PlaygroundEditor({
    settings,
    onFieldChange,
    onCharacterPromptsChange,
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

            <div className="flex flex-col gap-3">
                <span className="text-sm font-medium">캐릭터 프롬프트</span>
                <CharacterPromptEditor
                    characterPrompts={settings.characterPrompts}
                    usePositions={settings.parameters.useCharacterPositions}
                    onUsePositionsChange={(enabled) =>
                        onParameterChange('useCharacterPositions', enabled)
                    }
                    onChange={onCharacterPromptsChange}
                />
            </div>

            <ParametersForm
                scope="playground"
                parameters={settings.parameters}
                onChange={onParameterChange}
            />
        </div>
    )
}
