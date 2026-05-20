import { useRouterState } from '@tanstack/react-router'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
} from '#/components/ui/breadcrumb'
import { Separator } from '#/components/ui/separator'
import { SidebarTrigger } from '#/components/ui/sidebar'

export function Header() {
    const pathname = useRouterState({ select: (s) => s.location.pathname })

    const parts =
        pathname === '/'
            ? ['Home']
            : pathname
                  .slice(1)
                  .split('/')
                  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))

    return (
        <header className="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
            <SidebarTrigger className="-ms-1" />
            <Separator orientation="vertical" className="me-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
                <BreadcrumbList>
                    {parts.map((part, index) => (
                        <BreadcrumbItem key={index}>
                            <BreadcrumbLink href="#">{part}</BreadcrumbLink>
                            {index < parts.length - 1 && <BreadcrumbSeparator />}
                        </BreadcrumbItem>
                    ))}
                </BreadcrumbList>
            </Breadcrumb>
        </header>
    )
}
