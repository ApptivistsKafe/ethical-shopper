/**
 * Local development server — runs the Vercel function handlers on plain
 * node:http with no Vercel account, project link, or deploy required.
 *
 *   pnpm --filter @ethical-shopper/api dev:local      (port 3000)
 *
 * Loads environment from the repo root .env (and apps/api/.env if present).
 * Pair with an extension built via:  API_BASE_URL=http://localhost:3000 pnpm build
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env['PORT'] ?? 3000)

// ─── Minimal .env loader (no dotenv dependency) ───────────────────────────────

function loadEnvFile(path: string): void {
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

loadEnvFile(resolve(__dirname, '../../.env'))
loadEnvFile(resolve(__dirname, '.env'))

// ─── Vercel req/res shims ─────────────────────────────────────────────────────

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function shimResponse(res: ServerResponse): void {
  const r = res as ServerResponse & {
    status: (code: number) => typeof r
    json: (obj: unknown) => typeof r
    send: (body: string) => typeof r
  }
  r.status = (code: number) => {
    r.statusCode = code
    return r
  }
  r.json = (obj: unknown) => {
    r.setHeader('Content-Type', 'application/json')
    r.end(JSON.stringify(obj))
    return r
  }
  r.send = (body: string) => {
    r.end(body)
    return r
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

async function loadRoutes(): Promise<Record<string, Handler>> {
  const [analyze, suggest, recommend] = await Promise.all([
    import('./api/analyze.js'),
    import('./api/suggest.js'),
    import('./api/recommend.js'),
  ])
  return {
    '/api/analyze': analyze.default as unknown as Handler,
    '/api/suggest': suggest.default as unknown as Handler,
    '/api/recommend': recommend.default as unknown as Handler,
  }
}

const routes = await loadRoutes()

createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT.toString()}`)
    const handler = routes[url.pathname]

    if (!handler) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: `No route for ${url.pathname}` }))
      return
    }

    // Vercel parses JSON bodies before invoking the handler — mirror that.
    ;(req as IncomingMessage & { body: unknown }).body = await readJsonBody(req)
    shimResponse(res)

    try {
      await handler(req, res)
    } catch (err) {
      console.error(`[dev-server] ${url.pathname} crashed:`, err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: 'Internal error' }))
      } else {
        res.end()
      }
    }
  })()
}).listen(PORT, () => {
  console.log(`ethical-shopper dev API listening on http://localhost:${PORT.toString()}`)
  console.log(`  POST /api/analyze   (streaming NDJSON)`)
  console.log(`  POST /api/recommend`)
  console.log(`  POST /api/suggest`)
  console.log(
    `  env: OPENROUTER_API_KEY ${process.env['OPENROUTER_API_KEY'] ? '✓' : '✗ MISSING'}, ` +
      `BRAVE_API_KEY ${process.env['BRAVE_API_KEY'] ? '✓' : '✗ (no web context)'}, ` +
      `POSTGRES_URL ${process.env['POSTGRES_URL'] ? '✓' : '✗ (in-memory cache)'}`,
  )
})
