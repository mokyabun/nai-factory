<script lang="ts">
    import * as Sidebar from '$lib/components/ui/sidebar'
    import { Button } from '$lib/components/ui/button'
    import { goto } from '$app/navigation'
    import SettingsIcon from '@lucide/svelte/icons/settings'
    import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
</script>

<Sidebar.Header class="border-b">
    <div class="flex items-center gap-2 px-2 py-1">
        <SettingsIcon class="h-4 w-4" />
        <span class="font-medium">설정</span>
    </div>
</Sidebar.Header>
<Sidebar.Content>
    <Sidebar.Group>
        <Sidebar.GroupContent>
            <div class="px-2 py-3">
                <Button
                    variant="outline"
                    class="w-full justify-start gap-2"
                    onclick={() => goto('/settings')}
                >
                    <ExternalLinkIcon class="h-4 w-4" />
                    설정 페이지 열기
                </Button>
            </div>
            <div class="px-2 text-xs text-muted-foreground">
                <p>API 키, 전역 변수, 이미지 저장 형식 등을 설정할 수 있습니다.</p>
            </div>
        </Sidebar.GroupContent>
    </Sidebar.Group>
</Sidebar.Content>
