import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'

import { cn } from '@/lib/utils'

function SidebarPromptTabs({
    className,
    orientation = 'horizontal',
    ...props
}: TabsPrimitive.Root.Props) {
    return (
        <TabsPrimitive.Root
            data-slot="tabs"
            data-orientation={orientation}
            className={cn('group/sidebar-prompt-tabs flex gap-2 flex-col', className)}
            {...props}
        />
    )
}

function SidebarPromptTabsList({ className, ...props }: TabsPrimitive.List.Props) {
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            className={cn(
                'group/sidebar-prompt-tabs-list inline-flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-none bg-transparent p-[3px] text-muted-foreground',
                className,
            )}
            {...props}
        />
    )
}

function SidebarPromptTabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
    return (
        <TabsPrimitive.Tab
            data-slot="tabs-trigger"
            className={cn(
                'relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-none border border-transparent px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-active:bg-transparent data-active:text-foreground dark:text-muted-foreground dark:hover:text-foreground dark:data-active:border-transparent dark:data-active:bg-transparent dark:data-active:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
                'after:absolute after:inset-x-0 after:bottom-[-5px] after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity data-active:after:opacity-100',
                className,
            )}
            {...props}
        />
    )
}

function SidebarPromptTabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
    return (
        <TabsPrimitive.Panel
            data-slot="tabs-content"
            className={cn('flex-1 text-xs/relaxed outline-none', className)}
            {...props}
        />
    )
}

export {
    SidebarPromptTabs,
    SidebarPromptTabsContent,
    SidebarPromptTabsList,
    SidebarPromptTabsTrigger,
}
