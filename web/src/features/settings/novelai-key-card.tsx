import type { SettingsView } from '@nai-factory/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { call, contract, errorMessage } from '@/lib/api'
import { qk } from '@/lib/queries'

interface NovelAIKeyCardProps {
    settings: SettingsView | undefined
}

/** Write-only: the server only ever returns a masked hint such as `****abcd`. */
export function NovelAIKeyCard({ settings }: NovelAIKeyCardProps) {
    const queryClient = useQueryClient()
    const [editing, setEditing] = useState(false)
    const [value, setValue] = useState('')
    const hasApiKey = settings?.novelai.hasApiKey ?? false

    const onSaved = (data: SettingsView) => {
        queryClient.setQueryData(qk.settings.get(), data)
        void queryClient.invalidateQueries({ queryKey: qk.settings.novelAIStatus() })
        setValue('')
        setEditing(false)
    }

    const save = useMutation({
        mutationFn: (apiKey: string) => call(contract.settings.setNovelAIKey, { body: { apiKey } }),
        onSuccess: onSaved,
    })
    const remove = useMutation({
        mutationFn: () => call(contract.settings.deleteNovelAIKey),
        onSuccess: onSaved,
    })

    const showInput = !hasApiKey || editing

    return (
        <Card className="shrink-0">
            <CardHeader>
                <CardTitle className="text-base">NovelAI API Key</CardTitle>
                <CardDescription>
                    저장할 때 NovelAI에서 키를 확인합니다. 저장된 키는 다시 표시되지 않습니다.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {hasApiKey && !editing && (
                    <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate font-mono text-sm">
                            {settings?.novelai.keyHint}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                            변경
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => remove.mutate()}
                            disabled={remove.isPending}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            삭제
                        </Button>
                    </div>
                )}
                {showInput && (
                    <form
                        className="flex gap-2"
                        onSubmit={(event) => {
                            event.preventDefault()
                            if (value.trim()) save.mutate(value.trim())
                        }}
                    >
                        <Input
                            type="password"
                            autoComplete="off"
                            value={value}
                            onChange={(event) => setValue(event.target.value)}
                            placeholder="API 키 입력..."
                            className="min-w-0 flex-1 font-mono text-sm"
                        />
                        <Button type="submit" disabled={save.isPending || !value.trim()}>
                            {save.isPending ? '확인 중...' : '저장'}
                        </Button>
                        {editing && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setEditing(false)
                                    setValue('')
                                    save.reset()
                                }}
                            >
                                취소
                            </Button>
                        )}
                    </form>
                )}
                {(save.error || remove.error) && (
                    <p className="text-xs text-destructive">
                        {errorMessage(save.error ?? remove.error)}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
