import { useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { call, contract, errorMessage, onApiError } from '@/lib/api'

/**
 * Shown when the server requires `NAI_FACTORY_ACCESS_TOKEN` and the browser has no valid
 * token cookie yet. The server sets the cookie (HttpOnly) after a successful login.
 */
export function AccessTokenDialog() {
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)
    const [token, setToken] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    useEffect(
        () =>
            onApiError((failure) => {
                if (failure.status === 401 && failure.code === 'unauthorized') setOpen(true)
            }),
        [],
    )

    async function login() {
        setPending(true)
        setError(null)
        try {
            await call(contract.system.login, { body: { token } })
            setOpen(false)
            setToken('')
            await queryClient.invalidateQueries()
            // Reconnect realtime events with the new cookie.
            window.location.reload()
        } catch (failure) {
            setError(errorMessage(failure))
        } finally {
            setPending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={() => {}}>
            <DialogContent showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4" />
                        접근 토큰 필요
                    </DialogTitle>
                    <DialogDescription>
                        이 서버는 접근 토큰(NAI_FACTORY_ACCESS_TOKEN)을 요구합니다.
                    </DialogDescription>
                </DialogHeader>
                <form
                    className="flex flex-col gap-2"
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (token) void login()
                    }}
                >
                    <Input
                        type="password"
                        autoComplete="current-password"
                        value={token}
                        onChange={(event) => setToken(event.target.value)}
                        placeholder="토큰 입력..."
                    />
                    {error && <p className="text-xs text-destructive">{error}</p>}
                    <DialogFooter>
                        <Button type="submit" disabled={pending || !token}>
                            {pending ? '확인 중...' : '확인'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
