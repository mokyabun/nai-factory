import { Copy } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { formatDateTime, parseIso } from '@/lib/time'

interface ImageMetadataSheetProps {
    /** Shown under the title, e.g. "Image #12"; null when the image is missing. */
    label: string | null
    metadata: Record<string, unknown>
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ImageMetadataSheet({
    label,
    metadata,
    open,
    onOpenChange,
}: ImageMetadataSheetProps) {
    const parameters = readRecord(metadata.parameters)
    const characterPrompts = readArray(metadata.characterPrompts)
    const vibeTransfers = readArray(metadata.vibeTransfers)
    const characterReferences = readArray(metadata.characterReferences)
    const prompt = readString(metadata.prompt)
    const negativePrompt = readString(metadata.negativePrompt)

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[min(440px,100vw)] sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>이미지 메타데이터</SheetTitle>
                    <SheetDescription>{label ?? '이미지를 찾을 수 없습니다.'}</SheetDescription>
                </SheetHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
                    <MetadataSection title="Prompt">
                        <CopyBlock value={prompt} />
                    </MetadataSection>

                    <MetadataSection title="Negative Prompt">
                        <CopyBlock value={negativePrompt} />
                    </MetadataSection>

                    <MetadataSection title="Parameters">
                        <div className="grid grid-cols-2 gap-2">
                            <MetadataValue label="model" value={readString(parameters.model)} />
                            <MetadataValue label="seed" value={readPrimitive(parameters.seed)} />
                            <MetadataValue label="size" value={formatSize(parameters)} />
                            <MetadataValue label="steps" value={readPrimitive(parameters.steps)} />
                            <MetadataValue
                                label="guidance"
                                value={readPrimitive(parameters.promptGuidance)}
                            />
                            <MetadataValue
                                label="rescale"
                                value={readPrimitive(parameters.promptGuidanceRescale)}
                            />
                            <MetadataValue label="sampler" value={readString(parameters.sampler)} />
                            <MetadataValue
                                label="noise"
                                value={readString(parameters.noiseSchedule)}
                            />
                        </div>
                    </MetadataSection>

                    <MetadataSection title="References">
                        <div className="grid grid-cols-2 gap-2">
                            <MetadataValue
                                label="character prompts"
                                value={String(characterPrompts.length)}
                            />
                            <MetadataValue
                                label="vibe transfers"
                                value={String(vibeTransfers.length)}
                            />
                            <MetadataValue
                                label="character refs"
                                value={String(characterReferences.length)}
                            />
                            <MetadataValue
                                label="generated"
                                value={formatDate(readString(metadata.generatedAt))}
                            />
                        </div>
                    </MetadataSection>

                    {characterPrompts.length > 0 && (
                        <MetadataSection title="Character Prompts">
                            <pre className="max-h-48 overflow-auto rounded border bg-muted p-2 text-[11px] leading-relaxed">
                                {JSON.stringify(characterPrompts, null, 2)}
                            </pre>
                        </MetadataSection>
                    )}

                    <MetadataSection title="Raw JSON">
                        <pre className="max-h-72 overflow-auto rounded border bg-muted p-2 text-[11px] leading-relaxed">
                            {JSON.stringify(metadata, null, 2)}
                        </pre>
                    </MetadataSection>
                </div>
            </SheetContent>
        </Sheet>
    )
}

function MetadataSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium">{title}</h3>
            {children}
        </section>
    )
}

function MetadataValue({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0 rounded border bg-background/40 p-2">
            <div className="truncate text-[10px] text-muted-foreground">{label}</div>
            <div className="mt-1 break-words font-mono text-[11px]">{value || '-'}</div>
        </div>
    )
}

function CopyBlock({ value }: { value: string }) {
    async function copy() {
        if (!value) return
        await navigator.clipboard.writeText(value)
    }

    return (
        <div className="rounded border bg-background/40">
            <div className="flex items-center justify-end border-b p-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={copy}
                    disabled={!value}
                >
                    <Copy className="h-3.5 w-3.5" />
                    복사
                </Button>
            </div>
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap p-2 text-[11px] leading-relaxed">
                {value || '-'}
            </pre>
        </div>
    )
}

function readRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
}

function readArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value : ''
}

function readPrimitive(value: unknown): string {
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return ''
}

function formatSize(parameters: Record<string, unknown>) {
    const width = readPrimitive(parameters.width)
    const height = readPrimitive(parameters.height)
    return width && height ? `${width} x ${height}` : ''
}

function formatDate(value: string) {
    if (!value) return ''
    const date = parseIso(value)
    if (Number.isNaN(date.getTime())) return value
    return formatDateTime(date)
}
