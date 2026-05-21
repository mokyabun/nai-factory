<script lang="ts">
import * as Dialog from '$lib/components/ui/dialog'
import { Button } from '$lib/components/ui/button'
import { Input } from '$lib/components/ui/input'

let {
    open = $bindable(false),
    title,
    description,
    placeholder,
    onCreate,
}: {
    open?: boolean
    title: string
    description?: string
    placeholder: string
    onCreate: (name: string) => void
} = $props()

let name = $state('')

function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
    name = ''
    open = false
}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			{#if description}
				<Dialog.Description>{description}</Dialog.Description>
			{/if}
		</Dialog.Header>
		<form
			class="flex flex-col gap-4"
			onsubmit={(event) => {
				event.preventDefault()
				submit()
			}}
		>
			<Input bind:value={name} {placeholder} autofocus />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>취소</Button>
				<Button type="submit" disabled={!name.trim()}>만들기</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
