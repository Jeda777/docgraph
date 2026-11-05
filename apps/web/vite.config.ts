import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'

// Module ids use forward slashes on every platform.
const vendor = (packages: string) => new RegExp(`/node_modules/(?:${packages})/`)

// Editor libraries, split out so the app shell stays small and they cache across releases.
const EDITOR_CHUNKS = [
  { name: 'xyflow', test: vendor('@xyflow|d3-[^/]+'), priority: 1 },
  { name: 'tiptap', test: vendor('@tiptap'), priority: 1 },
  // Above tiptap, which would otherwise take it along and grow past the 500 kB warning.
  { name: 'prosemirror', test: vendor('prosemirror-[^/]+|orderedmap|rope-sequence'), priority: 2 },
  { name: 'hocuspocus', test: vendor('@hocuspocus'), priority: 1 },
]

// A group also takes every module its members import, so libraries the app shell shares with
// the editors get a group of their own, with a higher priority. Without it React would land in
// the xyflow chunk and the login screen would have to load the editors.
const SHARED_CHUNKS = [
  {
    name: 'react',
    test: vendor('react|react-dom|scheduler|use-sync-external-store|zustand'),
    priority: 3,
  },
  { name: 'yjs', test: vendor('yjs|lib0|y-protocols'), priority: 3 },
  { name: 'floating-ui', test: vendor('@floating-ui'), priority: 3 },
]

/**
 * Hints the browser to fetch the editor chunks while idle, so opening the first item is fast.
 * `prefetch` rather than `modulepreload`: the login screen and project lists don't need them,
 * so they must not compete with what the current page loads.
 */
const prefetchEditorChunks = (): Plugin => ({
  name: 'prefetch-editor-chunks',
  apply: 'build',
  transformIndexHtml(_html, ctx): HtmlTagDescriptor[] {
    const chunks = Object.values(ctx.bundle ?? {}).filter((output) => output.type === 'chunk')

    // Skip chunks Vite already preloads via the entry's static import graph.
    const byFileName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
    const staticallyImported = new Set<string>()
    const visit = (fileName: string) => {
      if (staticallyImported.has(fileName)) return
      staticallyImported.add(fileName)
      for (const imported of byFileName.get(fileName)?.imports ?? []) visit(imported)
    }
    for (const chunk of chunks) {
      if (chunk.isEntry) visit(chunk.fileName)
    }

    const editorNames = new Set(EDITOR_CHUNKS.map((group) => group.name))
    return chunks
      .filter((chunk) => editorNames.has(chunk.name) && !staticallyImported.has(chunk.fileName))
      .map((chunk) => ({
        tag: 'link',
        // `crossorigin` matches the CORS mode of the later module import, so it hits the cache.
        attrs: { rel: 'prefetch', href: `/${chunk.fileName}`, crossorigin: true },
        injectTo: 'head',
      }))
  },
})

// Assets the API server may serve precompressed (see `precompressed` in @hono/node-server serve-static).
// Fonts are skipped — woff2 is already compressed.
const COMPRESSIBLE_ASSETS = /\.(?:css|html|js|json|map|svg|txt|xml)$/

const precompressAssets = (): Plugin => {
  let outDir = ''

  return {
    name: 'precompress-assets',
    apply: 'build',
    configResolved: (config) => {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle: () => {
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
          entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
        )

      for (const file of walk(outDir)) {
        if (!COMPRESSIBLE_ASSETS.test(file)) continue
        const source = readFileSync(file)
        writeFileSync(`${file}.gz`, gzipSync(source, { level: 9 }))
        writeFileSync(`${file}.br`, brotliCompressSync(source))
      }
    },
  }
}

// biome-ignore lint/style/noDefaultExport: vite config
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    prefetchEditorChunks(),
    precompressAssets(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/mcp': 'http://localhost:3000',
      '/ws': 'ws://localhost:3000',
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [...SHARED_CHUNKS, ...EDITOR_CHUNKS],
        },
      },
    },
  },
})
