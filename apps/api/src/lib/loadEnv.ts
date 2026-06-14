import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Minimal .env loader (no dotenv dependency). Sets vars that aren't already in
 * process.env, so real environment / inline overrides always win.
 *
 * Used by local-only entrypoints (dev-server, eval harness). Production runs on
 * Vercel, where env vars are injected by the platform — this is never imported there.
 */
export function loadEnvFile(path: string): void {
  let content: string
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const line of content.split('\n')) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (match?.[1] && match[2] !== undefined && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
}

/**
 * Loads any .env found walking up from the calling module's directory toward
 * the repo root. Covers both apps/api/.env and the repo-root .env regardless of
 * how deep the caller sits (dev-server at apps/api root, eval at apps/api/evals).
 * Idempotent and only sets unset vars, so probing missing paths is harmless.
 *
 * @param metaUrl  pass `import.meta.url` from the calling module
 */
export function loadLocalEnv(metaUrl: string): void {
  let dir = dirname(fileURLToPath(metaUrl))
  for (let i = 0; i < 5; i++) {
    loadEnvFile(resolve(dir, '.env'))
    dir = resolve(dir, '..')
  }
}
