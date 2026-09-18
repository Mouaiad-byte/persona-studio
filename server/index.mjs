import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { config, configErrors } from './config.mjs'
import { authUrl, exchangeCode, storedToken } from './google/oauth.mjs'
import { collect } from './collect.mjs'
import { currentSnapshot } from './snapshotService.mjs'
import { addItem, applyTransition } from './lib/queue.mjs'
import { readJson, writeJson } from './store.mjs'

/**
 * The collector's local HTTP face. It serves the snapshot the console reads,
 * runs a collection on demand, and holds the OAuth dance.
 *
 * Bound to localhost by default: it holds a Google refresh token and has no
 * authentication of its own, so it is not something to expose.
 */

/** One-shot CSRF states for the OAuth redirect. */
const pendingStates = new Set()

const MAX_BODY_BYTES = 64 * 1024

/**
 * Read a JSON request body, refusing anything oversized rather than buffering
 * it. Local service, but an unbounded read is still an unbounded read.
 *
 * @param {import('node:http').IncomingMessage} request
 */
async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('request body is not valid JSON')
  }
}

const routes = {
  'GET /api/status': async () => ({
    ok: true,
    configured: configErrors().length === 0,
    configErrors: configErrors(),
    authorised: Boolean(storedToken()),
    scopes: storedToken()?.scope ?? null,
    dataDir: config.dataDir,
  }),

  'GET /api/snapshot': async () => currentSnapshot(),

  'POST /api/collect': async () => {
    const result = await collect()
    return result.report
  },

  /** Append a brief. New items always start unapproved — see lib/queue.mjs. */
  'POST /api/queue': async (request) => {
    const body = await readJsonBody(request)
    const personas = readJson('personas.json', [])
    const { queue, item } = addItem(readJson('queue.json', []), personas, body)
    writeJson('queue.json', queue)
    return { item }
  },

  /**
   * Move an item through the queue. The same gate the console draws with is
   * enforced here, so a refusal in the UI is a refusal on the server too — the
   * console is a convenience, not the guard.
   */
  'POST /api/queue/transition': async (request) => {
    const body = await readJsonBody(request)
    const personas = readJson('personas.json', [])
    const { queue, item } = applyTransition(readJson('queue.json', []), personas, body)
    writeJson('queue.json', queue)
    return { item }
  },
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${config.port}`)
  const key = `${request.method} ${url.pathname}`

  // CORS for the Vite dev server on another port. Localhost only, and only the
  // methods the console actually uses.
  response.setHeader('access-control-allow-origin', 'http://localhost:5173')
  response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end()
    return
  }

  try {
    if (url.pathname === '/auth/google' && request.method === 'GET') {
      const state = randomUUID()
      pendingStates.add(state)
      response.writeHead(302, { location: authUrl(state) }).end()
      return
    }

    if (url.pathname === '/auth/google/callback' && request.method === 'GET') {
      const state = url.searchParams.get('state') ?? ''
      if (!pendingStates.delete(state)) {
        response.writeHead(400, { 'content-type': 'text/plain' })
        response.end('State did not match a pending authorisation. Start again at /auth/google.')
        return
      }
      const error = url.searchParams.get('error')
      if (error) throw new Error(`Google returned "${error}"`)
      const code = url.searchParams.get('code')
      if (!code) throw new Error('no authorisation code in the callback')

      await exchangeCode(code)
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end('Authorised. Refresh token stored. You can close this tab and run `npm run collect`.\n')
      return
    }

    const handler = routes[key]
    if (!handler) {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: `no route for ${key}` }))
      return
    }

    const body = await handler(request)
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  } catch (error) {
    const message = String(/** @type {Error} */ (error).message ?? error)
    // A rejected transition or a malformed body is the request's problem; only
    // an unexpected failure is the server's.
    const isCallerError =
      /^(cannot |unknown |no queue item|a queue item needs|approve requires|reject requires|request body)/.test(
        message,
      )
    response.writeHead(isCallerError ? 400 : 500, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: message }))
  }
})

server.listen(config.port, '127.0.0.1', () => {
  const problems = configErrors()
  console.log(`persona-studio collector on http://localhost:${config.port}`)
  console.log(`  data dir: ${config.dataDir}`)
  if (problems.length > 0) {
    console.log(`  not configured yet: ${problems.join('; ')} — see docs/data-sources.md`)
  } else if (!storedToken()) {
    console.log(`  authorise once: open http://localhost:${config.port}/auth/google`)
  } else {
    console.log('  authorised. run `npm run collect` to refresh the snapshot.')
  }
})
