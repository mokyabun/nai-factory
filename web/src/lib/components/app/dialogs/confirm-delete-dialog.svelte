<script lang="ts">
    import * as AlertDialog from '$lib/components/ui/alert-dialog'

    let {
        open = $bindable(false),
        title = '정말 삭제할까요?',
        description = '이 작업은 되돌릴 수 없습니다.',
        onconfirm,
    }: {
        open?: boolean
        title?: string
        description?: string
        onconfirm: () => void
    } = $props()

    function handleConfirm() {
        onconfirm()
        open = false
    }
</script>

<AlertDialog.Root bind:open>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>{title}</AlertDialog.Title>
            <AlertDialog.Description>{description}</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel>취소</AlertDialog.Cancel>
            <AlertDialog.Action onclick={handleConfirm}>삭제</AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
