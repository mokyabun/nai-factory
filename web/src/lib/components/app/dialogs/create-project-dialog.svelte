<script lang="ts">
    import * as Dialog from '$lib/components/ui/dialog'
    import { Input } from '$lib/components/ui/input'
    import { Button } from '$lib/components/ui/button'
    import { Label } from '$lib/components/ui/label'

    let {
        open = $bindable(false),
        groupName = '',
        oncreate,
    }: {
        open?: boolean
        groupName?: string
        oncreate: (name: string) => void
    } = $props()

    let name = $state('')

    function handleSubmit() {
        if (!name.trim()) return
        oncreate(name.trim())
        name = ''
        open = false
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-sm">
        <Dialog.Header>
            <Dialog.Title>새 프로젝트 만들기</Dialog.Title>
            {#if groupName}
                <Dialog.Description>{groupName} 그룹에 추가</Dialog.Description>
            {/if}
        </Dialog.Header>
        <form
            onsubmit={(e) => {
                e.preventDefault()
                handleSubmit()
            }}
        >
            <div class="flex flex-col gap-4 py-2">
                <div class="flex flex-col gap-1.5">
                    <Label for="project-name">프로젝트 이름</Label>
                    <Input
                        id="project-name"
                        bind:value={name}
                        placeholder="프로젝트 이름 입력..."
                        autofocus
                    />
                </div>
            </div>
            <Dialog.Footer>
                <Button variant="outline" type="button" onclick={() => (open = false)}>취소</Button>
                <Button type="submit" disabled={!name.trim()}>만들기</Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
