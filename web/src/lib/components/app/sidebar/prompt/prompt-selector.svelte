<script lang="ts">
    import { Button } from '$lib/components/ui/button'

    const nameMap = {
        prompt: '프롬프트',
        variables: '변수',
        vibes: '바이브',
    }

    type MenuType = keyof typeof nameMap

    type Props = {
        menu?: MenuType
    }

    let { menu = $bindable('prompt') }: Props = $props()

    function handleMenuClick(selectedMenu: MenuType) {
        return () => {
            menu = selectedMenu

            localStorage.setItem('project-menu', selectedMenu)
        }
    }
</script>

{#snippet button(type: MenuType)}
    <Button
        class="h-full flex-1 hover:bg-sidebar-accent {menu === type
            ? 'bg-sidebar-accent text-accent-foreground'
            : ''}"
        variant="ghost"
        onclick={handleMenuClick(type)}>{nameMap[type]}</Button
    >
{/snippet}

<div class="flex h-12 items-center justify-between gap-[1px]">
    {@render button('prompt')}
    {@render button('variables')}
    {@render button('vibes')}
</div>
