import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Configuration from the environment, with a .env file read as a fallback so
 * secrets stay out of the repo and out of the frontend bundle. No dependency:
 * the format is KEY=value, one per line, `#` comments.
 */
function loadEnvFile(path) {
  try {
    const text = readFileSync(path, 'utf8')
    /** @type {Record<string, string>} */
    const out = {}
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const at = trimmed.indexOf('=')
      if (at === -1) continue
      const key = trimmed.slice(0, at).trim()
      let value = trimmed.slice(at + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

const root = resolve(import.meta.dirname, '..')
const fileEnv = loadEnvFile(resolve(root, '.env'))

/** @param {string} key @param {string} [fallback] */
function env(key, fallback) {
  return process.env[key] ?? fileEnv[key] ?? fallback
}

export const config = {
  root,
  dataDir: resolve(root, env('HOARD_DATA_DIR', 'data')),
  port: Number(env('PORT', '8787')),
  google: {
    clientId: env('GOOGLE_CLIENT_ID', ''),
    clientSecret: env('GOOGLE_CLIENT_SECRET', ''),
    redirectUri: env('GOOGLE_REDIRECT_URI', `http://localhost:${env('PORT', '8787')}/auth/google/callback`),
    /** Monetary scope is opt-in: it only works on a monetised channel and asks for more than most setups need. */
    includeRevenueScope: env('GOOGLE_INCLUDE_REVENUE_SCOPE', 'false') === 'true',
  },
}

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
]

export const GOOGLE_REVENUE_SCOPE = 'https://www.googleapis.com/auth/yt-analytics-monetary.readonly'

export function scopesFor() {
  return config.google.includeRevenueScope ? [...GOOGLE_SCOPES, GOOGLE_REVENUE_SCOPE] : GOOGLE_SCOPES
}

/** Config problems worth refusing to start over, rather than failing mid-request. */
export function configErrors() {
  const errors = []
  if (!config.google.clientId) errors.push('GOOGLE_CLIENT_ID is not set')
  if (!config.google.clientSecret) errors.push('GOOGLE_CLIENT_SECRET is not set')
  return errors
}
