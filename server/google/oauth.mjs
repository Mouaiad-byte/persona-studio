import { config, scopesFor } from '../config.mjs'
import { readJson, writeJson } from '../store.mjs'

const TOKEN_FILE = 'google-token.json'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

/**
 * Authorization-code flow for the YouTube read scopes.
 *
 * The refresh token lives in the data directory, never in the frontend bundle:
 * the Analytics API has no key-only mode, so the browser must not be the thing
 * holding these credentials.
 */

/** @param {string} state */
export function authUrl(state) {
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: 'code',
    scope: scopesFor().join(' '),
    // Needed to be issued a refresh token at all, and to be re-issued one
    // after the first consent.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

/** @param {string} code */
export async function exchangeCode(code) {
  const token = await postToken({
    code,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri: config.google.redirectUri,
    grant_type: 'authorization_code',
  })
  if (!token.refresh_token) {
    throw new Error(
      'Google returned no refresh token. Revoke the app at myaccount.google.com/permissions and authorise again.',
    )
  }
  writeJson(TOKEN_FILE, {
    refreshToken: token.refresh_token,
    scope: token.scope,
    obtainedAt: new Date().toISOString(),
  })
  return token
}

export function storedToken() {
  return readJson(TOKEN_FILE, /** @type {null | {refreshToken: string, scope?: string}} */ (null))
}

/** In-memory access token, so a burst of requests does not re-mint one each time. */
let cached = /** @type {null | {token: string, expiresAt: number}} */ (null)

export async function accessToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token

  const stored = storedToken()
  if (!stored) {
    throw new Error('Not authorised yet — open /auth/google in a browser first.')
  }
  const token = await postToken({
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    refresh_token: stored.refreshToken,
    grant_type: 'refresh_token',
  })
  cached = {
    token: token.access_token,
    expiresAt: Date.now() + (Number(token.expires_in) || 3600) * 1000,
  }
  return cached.token
}

/** @param {Record<string, string>} body */
async function postToken(body) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Google token endpoint returned ${response.status}: ${text}`)
  }
  return JSON.parse(text)
}
