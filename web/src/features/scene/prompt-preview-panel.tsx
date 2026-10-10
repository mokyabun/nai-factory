import type { ScenePreviewResult } from '@nai-factory/shared'
import { AlertCircle } from 'lucide-react'

export function PromptPreviewPanel({
    validationMessage,
    pendingSave,
    preview,
    loading,
}: {
    validationMessage: string | null
    pendingSave: boolean
    preview: ScenePreviewResult | null
    loading: boolean
}) {
    return (
        <aside className="flex min-h-0 flex-col gap-3 rounded-md border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">프롬프트 프리뷰</h2>
                <span className="text-[11px] text-muted-foreground">
                    {pendingSave ? 'Saving...' : 'Saved state'}
                </span>
            </div>

            {validationMessage ? (
                <div className="flex gap-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{validationMessage}</span>
                </div>
            ) : loading ? (
                <div className="rounded border bg-background/40 p-3 text-xs text-muted-foreground">
                    Loading preview...
                </div>
            ) : preview?.ok === false ? (
                <div className="flex gap-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{preview.error.message}</span>
                </div>
            ) : preview?.ok === true && preview.prompts.length > 0 ? (
                <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
                    {preview.prompts.map((prompt, index) => (
                        <section
                            // Index keys: the preview order follows the variation order.
                            key={index}
                            className="rounded border bg-background/40 p-2"
                        >
                            <h3 className="mb-2 text-xs font-medium">Variation {index + 1}</h3>
                            <PreviewBlock label="Prompt" value={prompt.prompt} />
                            <PreviewBlock label="Negative" value={prompt.negativePrompt} />
                            {prompt.characterPrompts.length > 0 && (
                                <PreviewBlock
                                    label="Character Prompts"
                                    value={JSON.stringify(prompt.characterPrompts, null, 2)}
                                />
                            )}
                        </section>
                    ))}
                </div>
            ) : (
                <div className="rounded border bg-background/40 p-3 text-xs text-muted-foreground">
                    No compiled prompts.
                </div>
            )}
        </aside>
    )
}

function PreviewBlock({ label, value }: { label: string; value: string }) {
    return (
        <div className="mb-2 last:mb-0">
            <div className="mb-1 text-[11px] text-muted-foreground">{label}</div>
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px] leading-relaxed">
                {value || '-'}
            </pre>
        </div>
    )
}
