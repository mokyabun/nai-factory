<script lang="ts">
import { Gear } from 'phosphor-svelte'
import { Button } from '$lib/components/ui/button'
import * as Sidebar from '$lib/components/ui/sidebar'
</script>

<Sidebar.Content>
	<Sidebar.Group>
		<Sidebar.GroupContent class="px-2 pt-2">
			<Button variant="outline" size="sm" class="w-full gap-1.5" href="/settings">
				<Gear class="h-3.5 w-3.5" />
				설정 페이지 열기
			</Button>
		</Sidebar.GroupContent>
	</Sidebar.Group>
</Sidebar.Content>
