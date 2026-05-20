import { Link } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { SidebarContent, SidebarGroup, SidebarGroupContent } from '#/components/ui/sidebar'

export function SidebarSettings() {
    return (
        <SidebarContent>
            <SidebarGroup>
                <SidebarGroupContent className="px-2 pt-2">
                    <Button variant="outline" size="sm" className="gap-1.5 w-full" asChild>
                        <Link to="/settings">
                            <Settings className="h-3.5 w-3.5" />
                            설정 페이지 열기
                        </Link>
                    </Button>
                </SidebarGroupContent>
            </SidebarGroup>
        </SidebarContent>
    )
}
