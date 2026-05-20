import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import {
    createRootRouteWithContext,
    HeadContent,
    Outlet,
    Scripts,
    useRouteContext,
    useRouterState,
} from '@tanstack/react-router'
import { FileJson } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SdStudioImportDialog } from '#/components/app/dialogs/sd-studio-import-dialog'
import { Header } from '#/components/app/header'
import { Sidebar } from '#/components/app/sidebar'
import { StatusBar } from '#/components/app/status-bar'
import { SidebarInset, SidebarProvider } from '#/components/ui/sidebar'
import { useJsonDrop } from '#/hooks/use-json-drop'
import { useSse } from '#/hooks/use-sse'
import { api } from '#/lib/api'
import { qk } from '#/lib/queries'
import shadcnCss from '#/shadcn.css?url'
import appCss from '#/styles.css?url'

interface RouterContext {
    queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
    head: () => ({
        meta: [
            { charSet: 'utf-8' },
            { name: 'viewport', content: 'width=device-width, initial-scale=1' },
            { title: 'NAI Factory' },
        ],
        links: [
            { rel: 'stylesheet', href: appCss },
            { rel: 'stylesheet', href: shadcnCss },
        ],
    }),
    shellComponent: RootDocument,
    component: RootLayout,
    ssr: false,
})

function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko" suppressHydrationWarning>
            <head>
                <HeadContent />
            </head>
            <body className="antialiased dark">
                {children}
                <Scripts />
            </body>
        </html>
    )
}

function RootLayout() {
    const { queryClient } = useRouteContext({ from: '__root__' })
    const pathname = useRouterState({ select: (s) => s.location.pathname })

    const activeProjectId = useActiveProjectId(pathname)
    useSse(queryClient)

    const { isDragOver, pendingFile, dragHandlers, clearPendingFile } = useJsonDrop()
    const [importDialogOpen, setImportDialogOpen] = useState(false)

    useEffect(() => {
        if (pendingFile) setImportDialogOpen(true)
    }, [pendingFile])

    function handleImportDialogOpenChange(open: boolean) {
        setImportDialogOpen(open)
        if (!open) clearPendingFile()
    }

    return (
        <QueryClientProvider client={queryClient}>
            <div className="relative flex h-screen flex-col overflow-hidden" {...dragHandlers}>
                {isDragOver && (
                    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-background/90 px-16 py-12">
                            <FileJson className="size-12 text-primary" />
                            <p className="text-base font-medium">SD Studio JSON 파일 놓기</p>
                        </div>
                    </div>
                )}

                <SidebarProvider style={{ '--sidebar-width': '350px' } as React.CSSProperties}>
                    <Sidebar projectId={activeProjectId} />
                    <SidebarInset className="flex flex-col overflow-hidden">
                        <Header />
                        <div className="flex flex-1 flex-col overflow-auto p-4">
                            <Outlet />
                        </div>
                        <StatusBar />
                    </SidebarInset>
                </SidebarProvider>
            </div>

            <SdStudioImportDialog
                open={importDialogOpen}
                onOpenChange={handleImportDialogOpenChange}
                file={pendingFile}
                projectId={activeProjectId}
            />
        </QueryClientProvider>
    )
}

function useActiveProjectId(pathname: string): number | null {
    const projectIdFromPath = pathname.startsWith('/project/')
        ? Number(pathname.split('/')[2]) || null
        : null

    const sceneIdFromPath = pathname.startsWith('/scene/')
        ? Number(pathname.split('/')[2]) || null
        : null

    const { data: sceneContext } = useQuery({
        queryKey: qk.sceneContext(sceneIdFromPath ?? 0),
        queryFn: async () => {
            const { data } = await api.scenes({ id: sceneIdFromPath as number }).summary.get()
            return data ? { projectId: (data as { projectId: number }).projectId } : null
        },
        enabled: sceneIdFromPath !== null,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
    })

    return projectIdFromPath ?? sceneContext?.projectId ?? null
}
