import type { Job } from '@nai-factory/shared'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useEffectEvent, useRef } from 'react'
import { toast } from 'sonner'

import { useSidebar } from '@/components/ui/sidebar'

import { useJobHistory } from './use-queue'

/** Shows a toast for every job that fails while the app is open. */
export function QueueFailureAlerts() {
    const navigate = useNavigate()
    const { isMobile, setOpen, setOpenMobile } = useSidebar()
    // eslint-disable-next-line react/purity -- Capture the mount timestamp once to filter older failure events.
    const mountedAt = useRef(Date.now())
    const seenIds = useRef(new Set<number>())

    const { data: history } = useJobHistory()

    // The sidebar follows `?sidebar=`, so the panel switches without leaving the current page.
    function showQueue() {
        void navigate({ to: '.', search: (prev) => ({ ...prev, sidebar: 'queue' }) })
        if (isMobile) setOpenMobile(true)
        else setOpen(true)
    }

    const notify = useEffectEvent((job: Job) => {
        const title = job.kind === 'playground' ? (job.prompt ?? 'Playground') : job.label
        toast.error(`생성 실패 · ${title}`, {
            id: `job-failed-${job.id}`,
            description: job.error ?? 'Unknown error',
            duration: 9000,
            action: { label: 'Queue 보기', onClick: showQueue },
        })
    })

    useEffect(() => {
        for (const job of history ?? []) {
            if (job.status !== 'failed' || !job.finishedAt) continue
            if (seenIds.current.has(job.id)) continue

            seenIds.current.add(job.id)
            if (new Date(job.finishedAt).getTime() >= mountedAt.current) notify(job)
        }
    }, [history])

    return null
}
