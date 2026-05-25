import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface CreateGroupDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreate: (name: string) => void
}

export function CreateGroupDialog({ open, onOpenChange, onCreate }: CreateGroupDialogProps) {
    const [name, setName] = useState('')

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name.trim()) return
        onCreate(name.trim())
        setName('')
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>새 그룹</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="그룹 이름..."
                        autoFocus
                    />
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            취소
                        </Button>
                        <Button type="submit" disabled={!name.trim()}>
                            만들기
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
