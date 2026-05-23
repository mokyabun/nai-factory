import { createFileRoute } from '@tanstack/react-router'
import { Factory } from 'lucide-react'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
            <Factory className="h-16 w-16 opacity-20" />
            <p className="text-sm">왼쪽에서 프로젝트를 선택하거나 새로 만드세요</p>
        </div>
    )
}
