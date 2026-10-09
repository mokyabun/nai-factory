import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { describeEnqueueCost, describeEnqueueTotal, type EnqueueSummary } from './enqueue-summary'

interface EnqueueConfirmDialogProps {
    summary: EnqueueSummary | null
    onCancel: () => void
    onConfirm: () => void
}

export function EnqueueConfirmDialog({ summary, onCancel, onConfirm }: EnqueueConfirmDialogProps) {
    const cost = summary && describeEnqueueCost(summary)

    return (
        <AlertDialog
            open={summary !== null}
            onOpenChange={(open) => {
                if (!open) onCancel()
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>이미지 {summary?.total ?? 0}장 예약</AlertDialogTitle>
                    <AlertDialogDescription>
                        {summary && describeEnqueueTotal(summary)}
                    </AlertDialogDescription>
                    {cost && <p className="text-sm font-medium text-destructive">{cost}</p>}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>예약</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
