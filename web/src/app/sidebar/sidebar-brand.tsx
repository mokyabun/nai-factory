import { Link } from '@tanstack/react-router'
import { Factory, X } from 'lucide-react'

import * as Base from '@/components/ui/sidebar'

export function SidebarBrand() {
    const { isMobile, setOpenMobile } = Base.useSidebar()

    return (
        <Base.SidebarHeader>
            <Base.SidebarMenu>
                <Base.SidebarMenuItem>
                    {isMobile ? (
                        <Base.SidebarMenuButton
                            size="lg"
                            className="h-10 justify-center p-0 [&_svg]:size-5 [&>div:last-child]:sr-only"
                            aria-label="사이드바 닫기"
                            onClick={() => setOpenMobile(false)}
                        >
                            <div className="flex aspect-square size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                <X className="size-5" />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">사이드바 닫기</span>
                                <span className="truncate text-xs">Close</span>
                            </div>
                        </Base.SidebarMenuButton>
                    ) : (
                        <Base.SidebarMenuButton
                            size="lg"
                            className="h-10 justify-center p-0 [&_svg]:size-5 [&>div:last-child]:sr-only"
                            render={<Link to="/" />}
                        >
                            <div className="flex aspect-square size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                <Factory className="size-5" />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">NAI Factory</span>
                                <span className="truncate text-xs">Local</span>
                            </div>
                        </Base.SidebarMenuButton>
                    )}
                </Base.SidebarMenuItem>
            </Base.SidebarMenu>
        </Base.SidebarHeader>
    )
}
