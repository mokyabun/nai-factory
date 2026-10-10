import { createFileRoute } from '@tanstack/react-router'

import { LogPage } from '@/features/log/log-page'

export const Route = createFileRoute('/log')({ component: LogPage })
