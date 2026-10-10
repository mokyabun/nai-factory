import type { NovelAIModel } from '@nai-factory/shared'

import { escapeXml } from '@/lib/xml'

/** An SVG placeholder used in `mock` mode; the asset pipeline converts it like a real image. */
export function createMockImage(input: {
    prompt: string
    model: NovelAIModel
    width: number
    height: number
    seed: number
}) {
    const width = Math.max(64, input.width)
    const height = Math.max(64, input.height)
    const prompt = escapeXml(input.prompt.slice(0, 160) || 'Mock NovelAI image')
    const model = escapeXml(input.model)

    return new Uint8Array(
        Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f4f4f5"/>
      <stop offset="1" stop-color="#d4d4d8"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="#71717a" stroke-width="2" stroke-dasharray="8 8"/>
  <text x="40" y="64" fill="#18181b" font-family="Menlo, monospace" font-size="24" font-weight="700">NovelAI Mock</text>
  <text x="40" y="104" fill="#3f3f46" font-family="Menlo, monospace" font-size="16">seed ${input.seed}</text>
  <text x="40" y="132" fill="#3f3f46" font-family="Menlo, monospace" font-size="16">${model}</text>
  <text x="40" y="168" fill="#27272a" font-family="sans-serif" font-size="16">${prompt}</text>
</svg>`),
    )
}
