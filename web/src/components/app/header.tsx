import { useRouterState } from '@tanstack/react-router'
import { Fragment } from 'react'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

export function Header() {
    const pathname = useRouterState({ select: (s) => s.location.pathname })

    const parts =
        pathname === '/'
            ? [{ key: '/', label: 'Home' }]
            : pathname
                  .slice(1)
                  .split('/')
                  .reduce<Array<{ key: string; label: string }>>((items, part) => {
                      const parentKey = items.at(-1)?.key ?? ''

                      items.push({
                          key: `${parentKey}/${part}`,
                          label: part.charAt(0).toUpperCase() + part.slice(1),
                      })

                      return items
                  }, [])

    return (
        <header className="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
            <SidebarTrigger className="-ms-1" />
            <Separator orientation="vertical" className="me-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
                <BreadcrumbList>
                    {parts.map((part, index) => (
                        <Fragment key={part.key}>
                            <BreadcrumbItem>
                                <BreadcrumbLink href="#">{part.label}</BreadcrumbLink>
                            </BreadcrumbItem>
                            {index < parts.length - 1 && <BreadcrumbSeparator />}
                        </Fragment>
                    ))}
                </BreadcrumbList>
            </Breadcrumb>
        </header>
    )
}
