import type { PromptVariable } from '@nai-factory/shared'
import { useMemo } from 'react'
import { CodeEditor } from '@/components/app/code-editor/code-editor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createPromptCompletionSource } from '@/lib/tag-autocomplete'
import { cn } from '@/lib/utils'

interface PromptEditorProps {
    prompt: string
    negativePrompt: string
    variables?: PromptVariable
    onPromptChange: (value: string) => void
    onNegativePromptChange: (value: string) => void
    className?: string
}

export function PromptEditor({
    prompt,
    negativePrompt,
    variables = [],
    onPromptChange,
    onNegativePromptChange,
    className,
}: PromptEditorProps) {
    const completionSource = useMemo(() => createPromptCompletionSource(variables), [variables])

    return (
        <Tabs
            defaultValue="prompt"
            className={cn('flex flex-col overflow-hidden border h-[300px]', className)}
        >
            <TabsList className="bg-transparent m-1">
                <TabsTrigger value="prompt" className="flex-1 text-xs">
                    프롬프트
                </TabsTrigger>
                <TabsTrigger value="negative" className="flex-1 text-xs">
                    부정 프롬프트
                </TabsTrigger>
            </TabsList>
            <TabsContent value="prompt" className="flex-1 overflow-hidden">
                <CodeEditor
                    value={prompt}
                    placeholder="프롬프트를 입력하세요..."
                    minLines={6}
                    className="h-full"
                    completionSource={completionSource}
                    onChange={onPromptChange}
                />
            </TabsContent>
            <TabsContent value="negative" className="flex-1 overflow-hidden">
                <CodeEditor
                    value={negativePrompt}
                    placeholder="부정 프롬프트를 입력하세요..."
                    minLines={6}
                    className="h-full"
                    completionSource={completionSource}
                    onChange={onNegativePromptChange}
                />
            </TabsContent>
        </Tabs>
    )
}
