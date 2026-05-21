<script lang="ts">
import * as AlertDialog from '$lib/components/ui/alert-dialog'

let {
    open = $bindable(false),
    title,
    description,
    onConfirm,
}: {
    open?: boolean
    title: string
    description: string
    onConfirm: () => void
} = $props()
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{title}</AlertDialog.Title>
			<AlertDialog.Description>{description}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>취소</AlertDialog.Cancel>
			<AlertDialog.Action variant="destructive" onclick={onConfirm}>삭제</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
