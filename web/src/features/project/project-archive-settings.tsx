import type { Project } from '@nai-factory/shared'
import { DEFAULT_ARCHIVE_INCLUDE } from '@nai-factory/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Download, FolderInput, Package, Upload } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { call, contract } from '@/lib/api'
import { qk } from '@/lib/queries'

import { ArchiveOption } from './archive-option'
import { downloadBlob, sanitizeFilename } from './project-files'
import { FilePicker, SettingsSection, usePendingTask } from './settings-section'

interface ProjectArchiveSettingsProps {
    project: Project | null
    onImported: () => void
}

export function ProjectArchiveSettings({ project, onImported }: ProjectArchiveSettingsProps) {
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { pending, run } = usePendingTask<'export' | 'import'>()
    const [include, setInclude] = useState(DEFAULT_ARCHIVE_INCLUDE)
    const [file, setFile] = useState<File | null>(null)

    function updateInclude(key: keyof typeof include, checked: boolean) {
        setInclude((current) => ({ ...current, [key]: checked }))
    }

    async function exportArchive() {
        if (!project) return
        const data = await call(contract.projects.exportArchive, {
            params: { id: project.id },
            body: { include },
        })

        downloadBlob(data, `${sanitizeFilename(project.name)}.naif`)
    }

    async function importArchive() {
        if (!file) return

        const data = await call(contract.projects.importArchive, { body: { archive: file } })

        await queryClient.invalidateQueries({ queryKey: qk.groups.all() })
        queryClient.setQueryData(qk.projects.get(data.id), data)
        onImported()
        void navigate({ to: '/project/$projectId', params: { projectId: String(data.id) } })
    }

    const busy = pending !== null

    return (
        <div className="flex flex-col gap-4">
            <SettingsSection
                icon={Package}
                title="아카이브 내보내기"
                description="프로젝트를 .naif 파일 하나로 저장합니다."
            >
                <span className="text-xs font-medium text-muted-foreground">포함 항목</span>
                <div className="grid gap-2 sm:grid-cols-2">
                    <ArchiveOption
                        id="archive-prompts"
                        label="프롬프트"
                        description="프롬프트 + 캐릭터 프롬프트 + 변수"
                        checked={include.prompts}
                        onChange={(checked) => updateInclude('prompts', checked)}
                    />
                    <ArchiveOption
                        id="archive-parameters"
                        label="파라미터"
                        description="모델, 해상도, 샘플러 등 생성 설정"
                        checked={include.parameters}
                        onChange={(checked) => updateInclude('parameters', checked)}
                    />
                    <ArchiveOption
                        id="archive-scenes"
                        label="씬"
                        description="씬 + 씬 변수"
                        checked={include.scenes}
                        onChange={(checked) => updateInclude('scenes', checked)}
                    />
                    <ArchiveOption
                        id="archive-character-references"
                        label="캐릭터 레퍼런스"
                        description="원본 + 가공 데이터"
                        checked={include.characterReferences}
                        onChange={(checked) => updateInclude('characterReferences', checked)}
                    />
                    <ArchiveOption
                        id="archive-vibe-transfers"
                        label="바이브 트랜스퍼"
                        description="원본 + 가공 데이터"
                        checked={include.vibeTransfers}
                        onChange={(checked) => updateInclude('vibeTransfers', checked)}
                    />
                    <ArchiveOption
                        id="archive-images"
                        label="결과 이미지"
                        description={include.scenes ? '이미지 + 썸네일' : '씬을 포함해야 합니다'}
                        checked={include.images}
                        disabled={!include.scenes}
                        onChange={(checked) => updateInclude('images', checked)}
                    />
                </div>
                <Button
                    type="button"
                    className="self-end"
                    disabled={!project || busy}
                    onClick={() => run('export', exportArchive, 'Export 완료')}
                >
                    <Download />
                    {pending === 'export' ? '생성 중...' : '.naif 다운로드'}
                </Button>
            </SettingsSection>

            <SettingsSection
                icon={FolderInput}
                title="아카이브 가져오기"
                description=".naif 파일을 새 프로젝트로 가져옵니다."
            >
                <div className="flex items-center gap-2">
                    <FilePicker
                        accept=".naif,application/zip,application/vnd.nai-factory.project+zip"
                        placeholder=".naif 파일 선택"
                        file={file}
                        disabled={busy}
                        onChange={setFile}
                        className="flex-1"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        disabled={!file || busy}
                        onClick={() => run('import', importArchive, 'Import 완료')}
                    >
                        <Upload />
                        {pending === 'import' ? '가져오는 중...' : '가져오기'}
                    </Button>
                </div>
            </SettingsSection>
        </div>
    )
}
