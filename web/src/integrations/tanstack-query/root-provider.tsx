import { QueryClient } from '@tanstack/react-query'

export function getContext() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { staleTime: 5000 },
        },
    })

    return {
        queryClient,
    }
}

export default function TanstackQueryProvider() {
    return null
}
