<script lang="ts">
import { Label } from '$lib/components/ui/label'
import { Switch } from '$lib/components/ui/switch'
import { cn } from '$lib/utils'

let {
    id,
    label,
    description,
    checked,
    disabled = false,
    onChange,
}: {
    id: string
    label: string
    description: string
    checked: boolean
    disabled?: boolean
    onChange: () => void
} = $props()
</script>

<div class={cn('flex items-start justify-between gap-4', disabled && 'opacity-40')}>
	<Label for={id} class="flex cursor-pointer flex-col gap-0.5">
		<span>{label}</span>
		<span class="text-xs font-normal text-muted-foreground">{description}</span>
	</Label>
	<Switch
		{id}
		checked={checked}
		disabled={disabled}
		class="mt-0.5 shrink-0"
		onCheckedChange={onChange}
	/>
</div>
