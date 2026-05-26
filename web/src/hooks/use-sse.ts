import type { QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { BASE_URL } from '@/lib/api'

export function useSse(queryClient: QueryClient) {
    useEffect(() => {
        const es = new EventSource(`${BASE_URL}/sse`)
        let reconnecting = false

        es.addEventListener('open', () => {
            if (reconnecting) queryClient.invalidateQueries()
            reconnecting = true
        })

        es.onmessage = (e: MessageEvent<string>) => {
            try {
                const { domain } = JSON.parse(e.data) as { domain: string }
                if (domain === 'images') {
                    queryClient.invalidateQueries({
                        predicate: (q) => q.queryKey[0] === 'images' || q.queryKey[0] === 'scenes',
                    })
                } else if (domain === 'queue') {
                    queryClient.invalidateQueries({
                        predicate: (q) => q.queryKey[0] === 'queue' || q.queryKey[0] === 'scenes',
                    })
                } else if (domain === 'debug') {
                    queryClient.invalidateQueries({
                        queryKey: ['debug'],
                    })
                }
            } catch {
                // ignore malformed messages
            }
        }

        return () => es.close()
    }, [queryClient])
}
