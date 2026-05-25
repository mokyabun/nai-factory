import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import ReactDOM from 'react-dom/client'
import { router } from './router'
import './styles.css'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 5000 },
    },
})

const rootElement = document.getElementById('app')

if (!rootElement) {
    throw new Error('Missing app root element')
}

if (!rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement)
    root.render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}
