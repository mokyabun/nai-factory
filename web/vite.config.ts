import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, type PluginOption } from 'vite'

const analyze = process.env.ANALYZE === 'true'

const config = defineConfig({
    resolve: { tsconfigPaths: true },
    build: {
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        {
                            name: 'react-vendor',
                            test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                            priority: 30,
                        },
                        {
                            name: 'tanstack-vendor',
                            test: /node_modules[\\/]@tanstack[\\/]/,
                            priority: 20,
                        },
                        {
                            name: 'base-ui-vendor',
                            test: /node_modules[\\/]@base-ui[\\/]/,
                            priority: 10,
                        },
                        {
                            name: 'vendor',
                            test: /node_modules[\\/]/,
                            priority: 1,
                            maxSize: 240_000,
                        },
                    ],
                },
            },
        },
    },
    plugins: [
        tailwindcss(),
        tanstackRouter({
            target: 'react',
            autoCodeSplitting: true,
            routeFileIgnorePattern: '(^|/)atom\\.ts$',
        }),
        viteReact(),
        analyze &&
            visualizer({
                filename: 'stats.html',
                open: true,
                gzipSize: true,
                brotliSize: true,
            }),
    ].filter(Boolean) as PluginOption[],
})

export default config
