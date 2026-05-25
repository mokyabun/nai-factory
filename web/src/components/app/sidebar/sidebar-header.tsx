import { Link } from '@tanstack/react-router'
import { Factory } from 'lucide-react'
import * as Base from '@/components/ui/sidebar'

export function SidebarHeader() {
    return (
        <Base.SidebarHeader>
            <Base.SidebarMenu>
                <Base.SidebarMenuItem>
                    <Base.SidebarMenuButton
                        size="lg"
                        className="md:h-8 md:p-0"
                        render={<Link to="/" />}
                    >
                        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                            <Factory className="size-4" />
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-semibold">NAI Factory</span>
                            <span className="truncate text-xs">Local</span>
                        </div>
                    </Base.SidebarMenuButton>
                </Base.SidebarMenuItem>
            </Base.SidebarMenu>
        </Base.SidebarHeader>
    )
}
