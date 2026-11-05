import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { build } from 'esbuild'

// Packages kept external because they contain native code that cannot be bundled.
const NATIVE_PACKAGES = [/^argon2($|\/)/]

const externalNames = new Set()

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node26',
  outfile: 'dist/index.js',
  sourcemap: true,
  // Allow CommonJS dependencies bundled into this ESM output to use require()
  banner: {
    js: "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);",
  },
  plugins: [
    {
      name: 'external-deps',
      setup(build) {
        // Bundle everything (workspace sources and pure JS dependencies)...
        build.onResolve({ filter: /^[^./]|^\.\.[^/]/ }, (args) => {
          // ...except native packages, resolved from node_modules at runtime
          if (!NATIVE_PACKAGES.some((pattern) => pattern.test(args.path))) {
            return undefined
          }

          const name = args.path.startsWith('@')
            ? args.path.split('/').slice(0, 2).join('/')
            : args.path.split('/')[0]
          externalNames.add(name)
          console.log('[external-deps] keeping external:', args.path)
          return { path: args.path, external: true }
        })
      },
    },
  ],
})

// Emit a package.json describing the runtime (external) dependencies, so the
// Docker image can install only what the bundle actually requires.
const requireFromServer = createRequire(path.resolve('package.json'))
const dependencies = {}
for (const name of [...externalNames].sort()) {
  // Resolve the package entry point and walk up to its package.json
  let dir = path.dirname(requireFromServer.resolve(name))
  let pkg = {}
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      const parsed = JSON.parse(readFileSync(pkgPath, 'utf8'))
      if (parsed.name === name && parsed.version) {
        pkg = parsed
        break
      }
    }
    dir = path.dirname(dir)
  }
  if (!pkg.version) {
    throw new Error(`Could not determine installed version of ${name}`)
  }
  dependencies[name] = pkg.version
}

mkdirSync('dist', { recursive: true })
writeFileSync('dist/runtime-package.json', `${JSON.stringify({ dependencies }, null, 2)}\n`)
