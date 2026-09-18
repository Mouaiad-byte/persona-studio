import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from './config.mjs'

/**
 * JSON and text files under the data directory. Writes go through a temp file
 * and a rename so a crashed collect cannot leave a half-written history behind.
 */

/** @param {string} name */
export function pathFor(name) {
  return resolve(config.dataDir, name)
}

/**
 * @template T
 * @param {string} name
 * @param {T} fallback returned when the file is absent
 * @returns {T}
 */
export function readJson(name, fallback) {
  try {
    return JSON.parse(readFileSync(pathFor(name), 'utf8'))
  } catch (error) {
    if (error && /** @type {any} */ (error).code === 'ENOENT') return fallback
    throw new Error(`${name} is not valid JSON: ${/** @type {Error} */ (error).message}`)
  }
}

/** @param {string} name @param {unknown} value */
export function writeJson(name, value) {
  mkdirSync(config.dataDir, { recursive: true })
  const target = pathFor(name)
  const temp = `${target}.tmp`
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temp, target)
}

/**
 * Append a line, creating the file if it is not there yet. Used for the revenue
 * ledger, where appending is the whole interaction — nothing rewrites past rows.
 *
 * @param {string} name
 * @param {string} line
 */
export function appendLine(name, line) {
  mkdirSync(config.dataDir, { recursive: true })
  const existing = readText(name, '')
  const needsNewline = existing.length > 0 && !existing.endsWith('\n')
  appendFileSync(pathFor(name), `${needsNewline ? '\n' : ''}${line}\n`, 'utf8')
}

/** @param {string} name @param {string} fallback */
export function readText(name, fallback = '') {
  try {
    return readFileSync(pathFor(name), 'utf8')
  } catch (error) {
    if (error && /** @type {any} */ (error).code === 'ENOENT') return fallback
    throw error
  }
}
